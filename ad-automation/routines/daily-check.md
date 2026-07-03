# Routine: 毎朝の数値チェック（daily-check）

> 定期実行ジョブの定義。実行基盤（Claude Code Routines / cron 等）に登録する前提のドキュメント。
> **読み取り→分析→下書き生成→承認キュー**まで。書き込み（適用）は含めない。

## スケジュール
- 既定：毎営業日 09:00 JST。

## 実行内容（毎回この順）
1. 対象クライアントの数値を取得（読み取りのみ / Meta先行、Google承認後に追加）。
2. `weekly-audit` スキル相当の照合を実行：
   ```bash
   python3 scripts/generate_proposals.py \
     --input data/<社名>_<日付>.csv \
     --client <社名> \
     --config clients/<社名>_thresholds.json \
     --out out/proposals_<社名>_<日付>.md
   ```
3. 出力を承認キュー（管理画面）へ。要対応・重度悪化があれば通知（Slack任意 / §通知）。
4. 承認待ちが営業日24h滞留していればリマインド。

## ガード（CLAUDE.md準拠）
- auto-approval 禁止。生成物は下書きのみ。新規は PAUSED。
- 予算 ±20%超 / 全停止の提案は上長承認フラグを立てる。
- データ取得失敗時は提案せず接続担当へ通知（推測で埋めない）。

## 前提
- Python 3.12+ / `.env` に接続情報（実値はGit管理外）。
- 無人運用に進む場合、Metaは組織所有の System User Token（無期限）を使用。

---

## 実装：毎朝8:30の自動取得（cron）

Meta実データ → `console/data.json` を毎朝更新（読み取りのみ）。

- 実行ラッパー：`scripts/daily_refresh.sh`（cd→`build_console_data.py`→`logs/refresh.log`）
- cron登録（重複回避・冪等）：
  ```bash
  CRON_LINE="30 8 * * * /Users/som-013/dev/ad-automation/scripts/daily_refresh.sh"
  ( crontab -l 2>/dev/null | grep -v 'daily_refresh.sh' ; echo "$CRON_LINE" ) | crontab -
  crontab -l | grep daily_refresh   # 確認
  ```
- ログ：`logs/refresh.log`（Git管理外）

### 注意
- Macが8:30に起動している必要あり（スリープ中は次回起動時に実行されないcronの仕様）。常時稼働機 or launchd化を推奨。
- 初回はターミナル/cronに「フルディスクアクセス」許可が要る場合あり（システム設定→プライバシー）。
- Metaトークンは60日失効。無人運用は Admin ロールの System User 無期限トークンへ切替を（§8）。

---

## 実装（推奨）：launchd で毎朝8:30（スリープ復帰対応）

cronの弱点（8:30にスリープ中だと取りこぼす）を避けるため、**launchdに一本化**（cronは削除済み）。
launchdは取りこぼし時に次回起動でまとめて実行する。

- 定義：`routines/com.sofcom.adops.refresh.plist`（Labelは `com.sofcom.adops.refresh`）
- インストール：
  ```bash
  cp routines/com.sofcom.adops.refresh.plist ~/Library/LaunchAgents/
  launchctl unload ~/Library/LaunchAgents/com.sofcom.adops.refresh.plist 2>/dev/null || true
  launchctl load -w ~/Library/LaunchAgents/com.sofcom.adops.refresh.plist
  launchctl list | grep sofcom        # 登録確認
  launchctl start com.sofcom.adops.refresh   # 手動テスト実行
  ```
- 解除：`launchctl unload ~/Library/LaunchAgents/com.sofcom.adops.refresh.plist`
- ログ：`logs/refresh.log`（処理内容）／`logs/launchd.*.log`（launchd標準出力）

※ Metaトークンは60日失効 → 無人運用は Admin ロールの System User 無期限トークンへ（§8）。
