# Claude Ads 採用メモ（監査エンジン）

このプロジェクトは、広告監査の土台に OSS **Claude Ads**（`AgriciDaniel/claude-ads`、MIT）を採用する。
手動4〜6時間の監査を10〜15分に。Google/Meta/YouTube/LinkedIn/TikTok/Microsoft/Apple/Amazon 対応、250+チェック・スコアリング・並列サブエージェント。**読み取り・監査のみ**（変更適用は手動＝当社の承認ゲートと整合）。

採用日：2026-07-04 ／ 版：v1.7.x ／ ライセンス：MIT

---

## 配置場所（グローバル）
- スキル：`~/.claude/skills/ads`（本体）＋ `~/.claude/skills/ads-*`（22サブスキル）
- エージェント：`~/.claude/agents/`（audit-google/meta/budget/compliance/creative/tracking ほか10）
- スクリプト：`~/.claude/skills/ads/scripts/*.py`
- ※グローバル導入なので全Claude Codeプロジェクトで `/ads` が使える。**Claude Code再起動後に有効**。

## 主なコマンド
- `/ads audit` … フル監査（6並列サブエージェントで統合スコア）
- `/ads google` / `/ads meta` … 媒体別
- `/ads plan <業種>` … 業種テンプレ戦略
- `/ads creative` / `/ads report` / `/ads math` / `/ads landing` ほか

## 再現手順（別マシン・引き継ぎ用）
```bash
# 方法A：公式インストーラ
git clone https://github.com/AgriciDaniel/claude-ads
cd claude-ads && bash install.sh --target=claude
# ※ install.sh は AI-Marketing-Hub/claude-ads から再cloneする。失敗する場合は方法B。

# 方法B：クローンから直接配置（当プロジェクトで採用した確実な方法）
#   クローンした ads/・skills/*・agents/*・scripts/* を ~/.claude/ 配下へコピー
#   （install.sh の配置ロジックと同じ。詳細は本リポジトリの導入時ログ参照）

# 依存（playwrightはLPスクショ専用・任意。コア監査には不要）
python3 -m pip install requests urllib3 Pillow matplotlib reportlab
```

## ★ レイヤリング（最重要）
Claude Ads は**汎用の監査エンジン**。当社の判断作法は必ずその上に被せる：

```
CLAUDE.md（最上位）… 会社の判断作法・医療広告ガイドライン(§3.2)・承認ゲート・エスカレーション
clients/<社名>.md ／ benchmarks.json … 個社の目標・禁止表現・承認ルール
─────────────────────────────────────────────
Claude Ads … 監査・スコア・提案（250+チェック）
console ／ 承認キュー ／ 書き込み(Phase C) … 当社の運用UI・承認・適用
```
- `/ads audit` の結果は**下書き/参考**。採否は CLAUDE.md と個社MDに従い、**書き込みは人間の承認後のみ**。
- 医療・美容の表現可否は **AIで確定せず医療広告確認者へエスカレーション**（§3.2/§5）。
- 既存の `skills/weekly-audit`・`skills/monthly-report` は Claude Ads と役割が重複。今後は Claude Ads を土台にし、当社ルールの上被せに徹する。

## 注意
- 監査時はアカウントデータをモデルに渡して分析する（データはローカル完結だが、医療・個社データの扱いは認識のうえで）。
- Python 3.10+ 推奨（当機は3.9のためスクリプト系は3.12導入後が安全）。
- reportlab は当環境で5.x が入っている（Claude Ads想定は4.x）。`/ads report` でPDF不具合が出たら 4.x へ調整。
- サードパーティ・単一メンテナ。更新時は差分を確認。
