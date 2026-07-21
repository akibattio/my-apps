# LINEヤフー広告 API 連携メモ（検索広告＋ディスプレイ広告）

読み取り専用でコンソール（日次監視）とクライアント提出レポートに Yahoo を合流させるための雛形。
実値（Client Secret / refresh token / accountId）は **.env と GitHub Secrets のみ**。コード/MD/チャットに出さない（CLAUDE.md §8）。

## 1. 必要な環境変数（.env / GitHub Secrets）

```
# 秘密（Secretsに登録・.envはGit管理外）
YAHOO_ADS_CLIENT_ID=＜アプリのClient ID＞
YAHOO_ADS_CLIENT_SECRET=＜アプリのClient Secret＞
YAHOO_ADS_REFRESH_TOKEN=＜認可で取得したrefresh token＞
# 識別子
YAHOO_ADS_BASE_ACCOUNT_ID=＜ベースアカウントID＞   # ヘッダ x-z-base-account-id。テスト時は 1001994926
YAHOO_ADS_API_VERSION=＜例 v13 / v202XXX＞          # ★稼働前にリファレンスで最新版を確認
YAHOO_ADS_REDIRECT_URI=＜アプリ登録時のリダイレクトURIと完全一致＞  # refresh_token取得時のみ
```

## 2. セットアップ手順（人間の操作が必要な部分）

1. **btam.line.biz** で権限グループに「参加する」
2. **API管理ツール**（connect-business.yahoo.co.jp/cooperation）でアプリ登録 → Client ID / Secret を発行
3. refresh_token を取得：
   ```
   python3 scripts/yahoo_generate_refresh_token.py
   ```
   表示URLをブラウザで開き→ビジネスID(motel7790swab)でログイン→許可→ code を貼付 → 出た refresh_token を .env へ
4. アカウント対応表を用意：`clients/yahoo_accounts.example.json` を `clients/yahoo_accounts.json` にコピーして実accountIdを記入（Git管理外）
5. 疎通確認（テストアカウントで）：
   ```
   python3 scripts/fetch_yahoo_insights.py
   ```

## 3. 稼働前チェック（creds取得後に1回のライブ実行で確定）

`scripts/fetch_yahoo_insights.py` 冒頭の CONFIG に集約：
- `YAHOO_ADS_API_VERSION`（検索/ディスプレイのリファレンスで最新値）
- OAuthトークンエンドポイントのホスト（既定 biz-oauth.yahoo.co.jp・要確認）
- レポート定義のフィールド列挙名（COST/IMPS/CLICKS/CONVERSIONS/DAY/MONTH）とレポート種別
確定したらこの定数だけ直せばよい（他は変更不要）。

## 4. パイプライン合流点（実装済み）

- `build_console_data.py` … `pull_yahoo()` が `yahoo_accounts.json` を読み、media=`yahoo_search`/`yahoo_display` でアカウント追加（未接続なら自動スキップ）
- `fetch_daily_series.py` / `fetch_monthly_series.py` … media が yahoo系なら `yahoo_daily`/`yahoo_monthly` を呼ぶ
- フロント（`console/ad_ops_console.jsx`）… MediaPill/媒体タブ/媒体内訳/媒体別リンクが Yahoo! に対応（`mediaFamily()` で yahoo系をまとめて絞込み）

## 5. レポート（クライアント提出）への合流 設計

有料広告レポートはコンソールと別建て（`out/` のHTML・`google_report_*` が生成）。Yahooの入れ方：

- **月次データは `console/monthly.json` に既に合流**（`byAccount["<社名>|yahoo_search"]` 等）。
  → コンソールのクライアント詳細（月次トレンド・前年同月比）は Yahoo を**自動表示**。
- **クライアント提出HTMLへの追加（follow-up）**：`google_report_monthly.py` は媒体非依存の月次JSONを描画できる作り。
  Yahoo用のデータ取得を `fetch_yahoo_insights.yahoo_monthly()`（＋キーワード別が要るなら別途）で用意し、
  `google_report_monthly.py` に「媒体ラベル」を渡して Google/Yahoo を並記 or 合算する薄い拡張を入れる。
  ※キーワード別レポートが必要な場合は検索広告APIのキーワードレポート追加が必要（ディスプレイは対象外）。

## 原則
- 書き込みAPIは一切呼ばない（下書きのみ・承認後に人間が適用）。
- データが取れない/欠損は「データなし」と表示し、推測で埋めない（§9）。
