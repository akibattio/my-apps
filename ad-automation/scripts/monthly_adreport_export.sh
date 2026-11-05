#!/bin/bash
# 毎月の自動受け渡し：Yahoo!・Microsoft広告の「先月分」を取得 → report-glass の pipeline/ に出力 → commit/push。
# push すると Render が自動デプロイし、起動時に pipeline/yahoo・microsoft を /var/data へ取り込む。
# launchd（com.sofcom.adops.monthly）から毎月3日 9:00 に実行。ログは logs/monthly_export.log。
# 読み取りのみ（広告媒体へは書き込まない）。秘密は .env から読み、ログ・コミットには出さない。
set -u
PROJ="/Users/som-013/dev/ad-automation"
RG="/Users/som-013/dev/report-glass"
MONTH="${1:-$(date -v1d -v-1m +%Y-%m)}"   # 省略時は先月
cd "$PROJ" || { echo "cd failed"; exit 1; }
mkdir -p logs
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') monthly export start (${MONTH}) ==="
  AD_REPORT_DIR="$RG/pipeline/yahoo" /usr/bin/python3 scripts/export_yahoo_for_adreport.py "$MONTH" \
    || echo "!! Yahooエクスポート失敗（続行）"
  AD_REPORT_DIR="$RG/pipeline/microsoft" /usr/bin/python3 scripts/export_microsoft_for_adreport.py "$MONTH" \
    || echo "!! Microsoftエクスポート失敗（続行）"

  cd "$RG" || { echo "cd report-glass failed"; exit 1; }
  git add pipeline/yahoo/*-"$MONTH".json pipeline/microsoft/*-"$MONTH".json 2>/dev/null
  if git diff --cached --quiet; then
    echo "変更なし（push不要）"
  else
    # パス指定で、pipeline/ 以外の作業中の変更を巻き込まない
    git commit -q -m "Yahoo/Microsoft ${MONTH} を自動取得（monthly_adreport_export.sh）" -- pipeline/yahoo pipeline/microsoft \
      && git push -q origin master && echo "push 完了 → Render が自動デプロイ"
  fi
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') monthly export done ==="
  echo ""
} >> logs/monthly_export.log 2>&1
