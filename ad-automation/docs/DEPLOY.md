# デプロイ手順（クラウド化・Mac非依存）

構成：**GitHub Actions（毎朝実行）→ Cloudflare Pages（配信）→ Cloudflare Access（Google Workspace SSO）**
- 生成（Google/Meta取得→監視→data.json）はGitHubのクラウドで毎朝8:30 JSTに自動実行（`.github/workflows/ad-automation-daily.yml`）。
- 画面 `console/`（＋data.json）をCloudflare Pagesが常時配信。
- クライアント機密のため、Cloudflare Accessで**会社のGoogleアカウントのみ**に限定。
- **書き込みは一切なし（読み取りのみ）**。トークンはGitHub Secretsに保管し、リポジトリには入れない（CLAUDE.md §8）。

---

## あなたの作業（1回だけ）

### 1. GitHub Secrets を登録
リポジトリ（my-apps）→ Settings → Secrets and variables → Actions → 「New repository secret」で以下を追加。
値は現在の `ad-automation/.env` からコピー（**私には渡さずGitHubに直接**）。

| Secret 名 | 中身 |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads 開発者トークン |
| `GOOGLE_ADS_CLIENT_ID` | OAuth クライアントID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth クライアントシークレット |
| `GOOGLE_ADS_REFRESH_TOKEN` | リフレッシュトークン |
| `GOOGLE_LOGIN_CUSTOMER_ID` | MCC ID |
| `SOFCOM_META_SYSTEM_USER_TOKEN` | Meta System User トークン |
| `CLOUDFLARE_API_TOKEN` | Cloudflare APIトークン（権限：Account > Cloudflare Pages > Edit） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウントID |
| （後日）`GOOGLE_CHAT_WEBHOOK_URL` | 通知有効化時のみ |

### 2. Cloudflare Pages プロジェクト作成
- Cloudflareダッシュボード → Workers & Pages → Create → Pages →「Direct Upload」→ プロジェクト名 **`sofcom-adops`**（ワークフローと一致させる）。
- Account ID は同ダッシュボードのURL/右サイドで確認 → `CLOUDFLARE_ACCOUNT_ID` に。
- APIトークンは My Profile → API Tokens → Create Token →「Cloudflare Pages: Edit」→ `CLOUDFLARE_API_TOKEN` に。

### 3. Cloudflare Access で認証（重要）
- Zero Trust → Access → Applications → Add application → Self-hosted。
- ドメイン：Pagesの `https://sofcom-adops.pages.dev`（独自ドメインを付けるならそれ）。
- ポリシー：**Emails ending in `@sofcom.co.jp`**（またはスタッフのメールを許可）。
- IdP：Google Workspace（One-time PIN でも可）。
- → これでURLを開くと会社アカウントのログインを求められ、スタッフだけが閲覧可能。

### 4. 初回デプロイ
- GitHub → Actions → 「ad-automation daily」→ **Run workflow**（手動実行）。
- 成功すると `https://sofcom-adops.pages.dev` に反映。以後は毎朝8:30 JSTに自動更新。

---

## 運用メモ
- **目標CPA・監視頻度は `clients/benchmarks.json` に記載してコミット**（共有環境ではlocalStorageは各ブラウザ限定のため。コンソールの「目標設定→benchmarks.jsonをコピー」で作った内容を貼り付け）。
- **Google Chat通知**：運用が固まったら、ワークフローの `NOTIFY_CHANNEL`/`GOOGLE_CHAT_WEBHOOK_URL` を有効化し、`monitor.py` を `monitor.py --send` に変更。
- Macのlaunchд（毎朝ローカル取得）は、クラウド運用に移行後は不要（残しても害はないが二重取得になる）。
- レポート(`out/`)も配信したい場合：デプロイ前に `out/` を `console/reports/` にコピーするステップを追加。
- ロールバック：Cloudflare Pages はデプロイ履歴から即ロールバック可能。
