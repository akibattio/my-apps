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
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') refresh done (exit $?) ==="
  echo ""
} >> logs/refresh.log 2>&1
