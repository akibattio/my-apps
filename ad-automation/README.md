# sofcom-ads（ad-automation）— 広告運用 半自動化

Google / Meta 広告運用の**半自動化**基盤。データ取得→分析→**提案の下書き生成**→レポートまでを自動化し、
書き込み（適用）は**人間の承認後のみ**行う。最重要方針は**非属人化**（担当が代わっても同じ基準で運用できる）。

- 設計背景・フェーズ計画・媒体別セットアップ：**[HANDOFF_広告運用自動化.md](HANDOFF_広告運用自動化.md)**
- 全社共通の判断ルール：**[CLAUDE.md](CLAUDE.md)**（最上位・最重要）

## ディレクトリ構成
```
ad-automation/
├── HANDOFF_広告運用自動化.md   引き継ぎ書（設計の出発点）
├── CLAUDE.md                    ★ 全社共通ルールブック（判断基準・禁止事項・承認・様式）
├── clients/
│   ├── ハルナ美容外科.md        個社の接続台帳＋ルール（実値は書かない）
│   └── haruna_thresholds.example.json  個社しきい値の見本
├── skills/
│   ├── weekly-audit/            週次監査（しきい値照合→下書き）
│   └── monthly-report/          月次レポート
├── routines/daily-check.md      毎朝の定期チェック定義
├── scripts/
│   ├── fetch_meta_insights.py            Meta読み取り雛形 → CSV出力（書き込みしない）
│   ├── fetch_google_insights.py          Google読み取り雛形 → CSV出力（書き込みしない）
│   ├── google_generate_refresh_token.py  Google OAuth Refresh Token 生成ヘルパー
│   └── generate_proposals.py             提案(下書き)生成 — 媒体へ書き込まない
├── console/                     管理画面（プロトタイプ配置先）
├── data/samples/                サンプル数値（実データはGit管理外）
├── .env.example                 環境変数の見本（実値は .env へ）
└── .gitignore
```

## パイプライン（読み取り → 提案下書き）
```
Meta読み取り(fetch_meta_insights.py) → CSV → しきい値照合(generate_proposals.py) → 提案下書きMD → 人間承認
```
トークン取得後の本番手順（Meta）:
```bash
python3 scripts/fetch_meta_insights.py \
  --account-env HARUNA_META_AD_ACCOUNT_ID \
  --token-env HARUNA_META_ACCESS_TOKEN \
  --days 7 --conversion-action offsite_conversion.fb_pixel_lead \
  --out data/haruna_2026-07-02.csv
```

## クイックスタート（トークン無しでも動く：サンプルで提案下書き）
```bash
# 全社既定値で（目標未設定なら「要確認」付きで出力）
python3 scripts/generate_proposals.py \
  --input data/samples/metrics_sample.csv --client ハルナ美容外科

# 個社の目標CPA/ROASを入れて評価
python3 scripts/generate_proposals.py \
  --input data/samples/metrics_sample.csv --client ハルナ美容外科 \
  --config clients/haruna_thresholds.example.json \
  --out out/proposals_2026-07-02.md
```
> Python 3.12+ 推奨（Meta/Google の公式MCP/CLI要件）。本スクリプト自体は標準ライブラリのみで動作。

## 絶対に守ること（詳細は CLAUDE.md §0）
1. 書き込みは人間承認後のみ。auto-approval は使わない。
2. 新規エンティティは PAUSED で下書き。
3. トークン/シークレットの実値はリポジトリ・MD・チャットに出さない（環境変数名のみ）。
4. 医療・美容は各媒体＋医療広告ガイドライン厳守。可否判断は人間へエスカレーション。

## 現在地とTODO（Phase 0）
- [x] リポジトリ基盤 / CLAUDE.md / 個社台帳雛形 / 提案生成スクリプト
- [ ] **個社の目標CPA/ROAS・悪化しきい値**を `clients/` に入力（現状プレースホルダ）
- [ ] Meta 接続（`act_xxxx`・BM権限確認）→ 読み取り疎通
- [ ] Google 開発者トークン申請（審査待ち）→ 承認後に読み取り接続
- [ ] Slack通知の要否判断
- [ ] `console/ad_ops_console.jsx` の取り込み → 実データ接続（Phase 2）
