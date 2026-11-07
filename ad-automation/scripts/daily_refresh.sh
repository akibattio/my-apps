#!/bin/bash
# 毎朝の自動取得：Meta実データ → console/data.json を更新（読み取りのみ・書き込みなし）
# cron から 8:30 に実行される。ログは logs/refresh.log。
set -u
PROJ="/Users/som-013/dev/ad-automation"
cd "$PROJ" || { echo "cd failed"; exit 1; }
mkdir -p logs
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh start ==="
  # スリープ復帰直後はネット未接続のまま走り、全媒体が名前解決エラーで失敗する（2026-10末〜頻発）。
  # 繋がるまで最大10分待つ。繋がらなければ中断して、手元の data.json（前回値）を壊さない。
  net_ok=0
  for i in $(seq 1 60); do
    if /usr/bin/python3 -c "import socket; socket.getaddrinfo('googleads.googleapis.com', 443)" 2>/dev/null; then net_ok=1; break; fi
    sleep 10
  done
  if [ "$net_ok" != 1 ]; then
    echo "!! ネットワークに10分繋がらないため中断（前回データを温存）"
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh ABORTED ==="
    exit 1
  fi
  # 最重要データ取得。ここが失敗したら、古い console/data.json で監査・提案・監視を走らせないよう中断する
  if ! /usr/bin/python3 scripts/build_console_data.py; then
    echo "!! build_console_data.py が失敗。古いデータでの監査・提案・監視を避けるため中断します。"
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh ABORTED ==="
    exit 1
  fi
  # 日次時系列(過去35日)を取得＝急変検知(インプ急停止/消化大幅増減/CPC高騰)のベースライン
  /usr/bin/python3 scripts/fetch_daily_series.py
  # 過去13か月の日次を蓄積（コンソールの「期間集計」＝任意の開始日〜終了日の集計用）→ console/history.json
  # 初回・新規口座は13か月分、以降は直近40日だけ取り直して上書き。失敗した口座は前回までの蓄積を維持。
  /usr/bin/python3 scripts/fetch_daily_history.py || true
  # Google検索の診断(IS変動/不要検索クエリ)
  /usr/bin/python3 scripts/fetch_search_diagnostics.py
  # クリエイティブ別の週次推移(Google/Meta・直近8週＋今週)→ console/creatives_weekly.json
  /usr/bin/python3 scripts/fetch_creative_weekly.py || true
  # 月次時系列(前年同月比/長期トレンド用)→ console/monthly.json
  /usr/bin/python3 scripts/fetch_monthly_series.py || true
  # 監査（ads-google観点の機械チェック）→ console/audit.json
  /usr/bin/python3 scripts/build_audits.py || true
  # 提案の下書き生成（承認キュー）→ console/data.json の proposals
  /usr/bin/python3 scripts/build_proposals.py || true
  # 監視（読み取りのみ）→ ログと console/data.json の alerts。Google Chat へは1日1回だけ送る
  # （旧GitHub Actionsの朝8:30送信を引き継ぎ・2026-11-07）。手動の再実行では二重に送らないよう、送れた日を印で残す。
  # Webhook は .env の GOOGLE_CHAT_WEBHOOK_URL（未設定なら送信スキップ）。
  notified="logs/.chat_notified_$(date +%F)"
  if [ -e "$notified" ]; then
    /usr/bin/python3 scripts/monitor.py
  else
    mon_out=$(NOTIFY_CHANNEL=googlechat /usr/bin/python3 scripts/monitor.py --send 2>&1)
    echo "$mon_out"
    echo "$mon_out" | grep -q "通知: Google Chat へ送信" && touch "$notified"
  fi
  # 週次/月次ビュー用に日次時系列を配信ディレクトリへ複製
  cp data/daily.json console/daily.json 2>/dev/null || true
  # 本番コンソール(sofcom-adops.pages.dev)へ反映。認証情報は .env の CLOUDFLARE_API_TOKEN/ACCOUNT_ID（wranglerが読む）
  # launchd はPATHが最小なので node/npx は絶対パスで呼ぶ
  NODE_BIN="/Users/som-013/.nvm/versions/node/v24.15.0/bin"
  deploy_out=$(PATH="$NODE_BIN:$PATH" "$NODE_BIN/npx" -y wrangler@4 pages deploy console --project-name sofcom-adops \
       --branch main --commit-hash "$(git rev-parse --short HEAD)" --commit-dirty=true 2>&1)
  if echo "$deploy_out" | grep -q "Deployment complete"; then
    echo "本番コンソールへ反映しました"
  else
    echo "!! 本番コンソールへの反映に失敗（手元のデータは更新済み）"
    echo "$deploy_out" | grep -E "ERROR|✘" | head -3
  fi
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh done (exit $?) ==="
  echo ""
} >> logs/refresh.log 2>&1
