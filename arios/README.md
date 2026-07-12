# ARIOS

車の売買サイトではなく、一台ごとの歴史を100年残す信頼インフラ。
中心は売買ではなく Vehicle Timeline（一台の人生の時間軸）。

設計の正本:
- 思想・条文: ARIOS Constitution / Canon（変更禁止）
- 設計: Architecture v1.1（文書2-1）
- DB: Database Design v1.0（文書4）
- AI: AI Architecture v1.0（文書5）
- 実装順: Development Guide v1.0（文書10）

実務向け抜粋: `/Users/som-013/Desktop/Claude code/arios-summary/spec.html`

## 技術スタック（決定済み 2026-06-23）

- フロント: Next.js（App Router）+ TypeScript
- データ: Supabase（Postgres / Auth / Storage）
- 既存の「ARIOS Deal OS」（/dev/carmatching-apps, Next.js+SQLite）は段階的にこの上の
  admin として統合する。当面は参照用に残す。

## 絶対に守るDB原則（Database Design v1.0）

Vehicle is permanent. Owner changes. History grows. Trust accumulates.
**Data is never deleted.**

- 物理削除しない（参照は ON DELETE RESTRICT）。修正は追記＋AuditLog で残す
- Vehicle ID は永久。Owner が変わっても Vehicle/History は不変、Ownership が増えるだけ
- Owner情報と Vehicle情報は分離
- AIAnalysis は上書きせず毎回保存（append-only）
- TrustScore は証拠ベース（verificationLevel: LEVEL_0〜6）

## 実装状況

- [x] Phase 1（一部）: 中核スキーマ `supabase/migrations/0001_phase1_core.sql`
  - owners / vehicles / ownerships / histories / documents / images /
    ai_analyses / trust_scores / audit_logs（9テーブル＋enum）
  - 完了条件「Vehicleが永久保存される」のDB土台
- [x] Phase 1（一部）: Next.jsアプリ雛形
  - Next.js 15 (App Router) + TypeScript + Tailwind v4。`npm run build` OK
  - `app/`（layout / Top page / globals.css）、`app/api/health`（疎通確認）
  - `lib/supabase/`（client=ブラウザ / server=SSR / admin=service_role）
  - 疎通確認スクリプト `scripts/check-db.mjs`（読み取り専用）
- [x] Phase 1: Supabaseプロジェクト接続 + マイグレーション適用（2026-07-03）
  - `.env` 設定済み。`npm run migrate` で 0001 適用。中核9テーブル作成済み。
  - `/api/health` が 200（アプリ→Supabase 疎通OK）。Step 0（土台）完了。
  - APIキーは新方式（publishable=anon / secret=service_role）を使用。
  - DB接続は直接接続（db.<ref>.supabase.co:5432 / IPv6）を使用。
- [x] Phase 1: Storage（`vehicle-images` 公開バケット。`scripts/setup-storage.mjs`）
- [x] Step 1 公開登録（2026-07-03）: `/register`（写真最大10枚+手入力）→ Vehicle/History作成
  → `/thank-you` → 公開Timeline `/passport/[id]`。ログイン不要・動作確認済み。
- [x] Phase 1: Auth（Supabase Auth・メールOTP）。middleware / `/login` / `/auth/callback`。
- [x] Step 2 育てる（2026-07-03）: ログイン → `/garage`（自分の車一覧）→ `/garage/[id]`（詳細+Timeline）
  → `/garage/[id]/add-history`（履歴追加）。owners↔auth連携 + RLS（migration 0002）。動作確認済み。
- [x] Step 3(一部) AI下書き（2026-07-04）: `/register` の「AIで下書き」で写真→車種推定（claude-opus-4-8・
  画像入力+構造化出力）。断定せず確信度/根拠を返し、`ai_analyses` に append-only 保存。
  `.env` に `ANTHROPIC_API_KEY` が必要。`lib/ai/recognize.ts` / `app/register/recognize-action.ts`。
- [x] Step 4(一部) 信頼と公開（2026-07-04）: 公開パスポート `/passport/[id]` に証拠ベースの
  TrustScore（レベル/スコア/根拠）を表示。`lib/trust.ts`。写真/書類/VIN/履歴の充実で上がる。
- [x] 地固め: 書類アップロード（2026-07-05）: `/garage/[id]/add-document` で車検証等を**非公開**バケット
  `vehicle-documents` に保管。documents追加でパスポートのTrustがLEVEL_2「書類で確認」に上がる（動作確認済み）。
  公開ページには「書類あり」の事実だけ反映し、中身は非公開。
  - migration 0003（documents RLS）は**適用済み**（2026-07-12、SQL Editorで適用・台帳に記録）。
    ガレージの「現在N件」表示が有効。※DB直結がIPv6不通のため `npm run migrate` は使わずSQL Editorで適用した。
- [ ] Phase 2: 公開登録（Top / Register / Photo Upload / AI / Timeline / Thank You）

### 開発コマンド

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run migrate    # .env の SUPABASE_DB_URL にスキーマ適用
node --env-file=.env scripts/check-db.mjs  # 接続 & スキーマ & env の確認
```
接続後は `http://localhost:3000/api/health` で中核テーブルの疎通を確認できる。

Lead / Deal / Partner / Notification テーブルは文書4に定義済み。各Phaseで追加する。

## マイグレーションの当て方

Supabaseプロジェクト（クラウド）か、ローカルSupabase（Docker）が必要。

### A. Supabase クラウド
1. https://supabase.com でプロジェクト作成
2. `.env`（`.env.example` をコピー）に URL と各キーを設定
3. Supabase CLI で適用:
   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```
   もしくは SQL Editor に `supabase/migrations/0001_phase1_core.sql` を貼って実行

### B. ローカル（Docker 必須）
```bash
npx supabase init     # 初回のみ（このフォルダ構成を使う場合）
npx supabase start
npx supabase db reset # migrations を適用
```

## 注意

- このスキーマは「100年壊さない」中核。今後の変更は破壊的変更を禁止し、Migration の追加のみ。
- 区分値が正本で未列挙の status 系（vin_status / vehicle.status / verified_status）は
  暫定 text。正本で値が確定したら enum 化する Migration を追加する。
