#!/bin/bash
# 毎朝の自動取得：Meta実データ → console/data.json を更新（読み取りのみ・書き込みなし）
# cron から 8:30 に実行される。ログは logs/refresh.log。
set -u
PROJ="/Users/som-013/dev/ad-automation"
cd "$PROJ" || { echo "cd failed"; exit 1; }
mkdir -p logs
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh start ==="
  /usr/bin/python3 scripts/build_console_data.py
  # 日次時系列(過去35日)を取得＝急変検知(インプ急停止/消化大幅増減/CPC高騰)のベースライン
  /usr/bin/python3 scripts/fetch_daily_series.py
  # Google検索の診断(IS変動/不要検索クエリ)
  /usr/bin/python3 scripts/fetch_search_diagnostics.py
  # 取得直後に監視チェック（読み取りのみ・外部送信なし＝ログとconsole/data.jsonのalertsへ反映）
  # 通知(--send)は通知先(.env NOTIFY_CHANNEL)を設定してから有効化する
  /usr/bin/python3 scripts/monitor.py
  # 週次/月次ビュー用に日次時系列を配信ディレクトリへ複製
  cp data/daily.json console/daily.json 2>/dev/null || true
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh done (exit $?) ==="
  echo ""
} >> logs/refresh.log 2>&1
