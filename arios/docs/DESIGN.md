# ARIOS 設計書（シンプル版 / 開発の実務用）

作成: 2026-07-03

この文書の位置づけ:
思想と設計の正本は Constitution / Canon / Architecture v1.1 / Database Design v1.0。
それらは「100年壊さないための全体像」なので情報量が多い。
この DESIGN.md は、その中から「今すぐ手を動かすために必要な順番と最小構成」だけを抜き出した実務ガイド。
迷ったら正本が優先。矛盾したら正本に合わせてこの文書を直す。

---

## 1. 一番大事な考え方（これだけは崩さない）

ARIOS は車の売買サイトではない。
「一台の車に、消えない時間軸（Vehicle Timeline）を持たせる」インフラ。
売買はあくまで、歴史が育った結果として自然に生まれるもの。

100年壊さないための絶対原則は3つだけ覚えればいい:

1. History Never Dies — 記録は消さない。直すときも上書きせず追記する。
2. Vehicle Never Changes — 車のIDは永久。持ち主が変わっても車と履歴は不変。所有履歴（Ownership）が増えるだけ。
3. Owner is Independent — 個人情報（Owner）と車の情報（Vehicle）は分ける。

この3つを守っていれば、後から機能をいくら足しても土台は壊れない。

---

## 2. 複雑さの整理 — 「今作る」と「後で」

正本には12レイヤー / 14テーブル / 12種のAI / 12フェーズが出てくる。
全部を最初に作る必要はない。次のように仕分ける。

| 区分 | 内容 | 今の扱い |
|------|------|----------|
| 土台（永久・壊さない） | Vehicle / Owner / Ownership / History / Image / Document | 今作る。DBは作成済み |
| 育てる部分 | Auth（ログイン）/ My Garage / Timeline UI | 近いうちに作る |
| 賢くする部分 | AI解析（写真→車種・メーター・書類）| 後で足す。無くても成立する |
| 信頼の可視化 | TrustScore / Vehicle Passport（公開ページ）| その後 |
| 商売の部分 | Lead / Deal / Marketplace / Partner / 課金 | ずっと後。DBに「予約席」だけある |
| 横断機能 | Notification（LINE/WhatsApp）/ Global（多言語・多通貨）| ずっと後 |

重要な考え方:
DBスキーマ（0001）は14テーブルのうち中核9テーブルを既に用意していて、
残り（Lead / Deal / Partner / Notification）も設計は確定している。
だから「今は使わないけど、後で足しても土台は壊れない」= 予約席がある状態。
UI側は必要なぶんだけ、少しずつ作ればいい。

---

## 3. 一番小さく動くもの（MVP）

最初のゴールはこれだけ:

```
スマホで写真を撮って車を登録する
   ↓
その車に永久のTimeline（時間軸）ができる
   ↓
後からその車に出来事（History）を足せる
```

MVPでは、AIもログインも売買もいらない。手入力でいい。
「一台の車の歴史が、消えずに残り、増えていく」——これが動けば ARIOS の芯は成立する。
残りは全部、この芯に後から足していく飾り。

---

## 4. データモデル（今つかう分だけ）

今のUIで実際に触るのは、この中核だけ:

```
   Owner（人・会社）
     │  ← 個人情報はここに閉じる
     │
  Ownership（所有履歴：誰がいつ〜いつ所有したか。過去所有者も残す）
     │
   Vehicle（車そのもの・永久・ID不変）
     │
   History（人生の記録：整備/修理/事故/レース/旅/書類… 削除不可）
     ├── Image（写真：外装/エンジン/メーター/VINプレート…）
     └── Document（車検証/請求書/整備記録…）
```

まだ触らない（予約席）:
ai_analyses / trust_scores / audit_logs（土台にはある）、
Lead / Deal / Partner / Notification（DBに追加するのは各フェーズで）。

原則の実装メモ:
- 物理削除しない → 全リレーションは ON DELETE RESTRICT（設定済み）
- 直すときは追記 + audit_logs に記録
- 公開/非公開は削除ではなく visibility で制御

---

## 5. 画面（ロール別 / ルートは Architecture v1.1 準拠）

正本のページ構成。◎=MVPで作る / ○=そのあと / -=ずっと後。

訪問者（未ログイン・公開）
- ◎ `/` トップ
- ◎ `/register` 車を登録
- ◎ `/thank-you` 登録完了
- ○ `/passport/[vehicleId]` 公開Timeline（車のパスポート）
- - `/history` `/partner` `/privacy`

オーナー（ログイン後）
- ○ `/garage` 自分の車一覧
- ○ `/garage/[id]` 車の詳細 + Timeline
- ○ `/garage/[id]/add-history` 履歴を足す
- ○ `/account` `/settings`
- - `/dream-garage` `/notifications` `/messages`

管理者
- - `/admin/*`（ダッシュボード等）は当面、既存の Deal OS（/dev/carmatching-apps）で代替し、段階的に統合

---

## 6. 開発ステップ（シンプル版）

正本のPhase 1〜12を、迷わないよう小さいStepに束ね直したもの。
各Stepは「これが動いたら次へ」の完了条件つき。順番に、1つずつ。

### Step 0 — 土台（ほぼ完了）
作るもの: DBスキーマ / Next.jsアプリ雛形 / Supabase接続 / Storage
完了条件: `/api/health` が緑（中核テーブルに疎通できる）
状態: スキーマ・アプリ雛形は完了。残りは .env を埋めて migrate → 接続確認。
canon対応: Phase 1

### Step 1 — 登録して残る（AIなし・手入力）✅ 完了（2026-07-03）
作るもの: `/` → `/register`（写真最大10枚 + 最小限の手入力：メーカー/モデル/年式）
→ Vehicle と最初のHistory(=登録)を作成 → `/thank-you` → 公開Timeline `/passport/[id]`
完了条件: スマホだけで1台登録でき、その車のTimelineが永久に残る → 達成・動作確認済み
実装メモ:
  - ログイン不要。写真はSupabase Storage(`vehicle-images` 公開バケット)へ。
  - 書き込みはサーバーの service_role で実行（認証・RLSポリシーは Step 2 で追加）。
  - 主要ファイル: `app/register/`（page/RegisterForm/actions）、`app/thank-you/`、
    `app/passport/[vehicleId]/`、`scripts/setup-storage.mjs`。
canon対応: Phase 2（AI/Statusは後回し）

### Step 2 — ログインして育てる ✅ 完了（2026-07-03）
作るもの: Auth（Supabase Auth・メールOTP）/ `/login` / `/garage`（自分の車一覧）
/ `/garage/[id]`（詳細+Timeline）/ `/garage/[id]/add-history`（種類選択+写真+メモで履歴追加）
完了条件: ログインしたオーナーが、自分の車に毎日Historyを足せる → 達成・動作確認済み
実装メモ:
  - メールOTP（6桁コード）ログイン。マジックリンクは `/auth/callback` で処理。
  - `owners.auth_user_id` でユーザーとOwnerを1:1連携（migration 0002）。ログイン時に自動作成。
  - RLS: authenticated は「自分のOwner/所有Vehicle/その履歴・写真」だけ読み書き可（deleteなし）。
    読み取りはユーザーセッションのSSRクライアント（RLS適用）、書き込みは所有権をコードで確認のうえ service_role。
  - 登録時にログイン中なら Vehicle に current_owner_id と Ownership を紐付ける。
  - 主要ファイル: `middleware.ts`、`lib/auth.ts`、`app/login/`、`app/auth/`、`app/garage/`。
canon対応: Phase 2（認証）+ Phase 3（My Garage）

### Step 3 — AIで入力を楽にする（最小から）✅ 一部完了（2026-07-04）
作るもの: 写真から車種を推定して登録フォームを下書き。人が確認して保存。
完了条件: 写真を出すと入力欄が下書きで埋まる（最終確認は人）→ Vehicle Recognition は達成・動作確認済み
実装メモ:
  - Claude（claude-opus-4-8）の画像入力 + 構造化出力（json_schema）で
    メーカー/モデル/年式/確信度/根拠を返す。`lib/ai/recognize.ts`。
  - 登録フォームに「AIで下書き」ボタン（`app/register/recognize-action.ts` + RegisterForm）。
    フィールドは controlled で、AIが下書き→人が編集して登録。
  - AI Assists の原則を実装: 断定しない・確信度と根拠を返す・空なら埋めない。
  - 解析は `ai_analyses` に append-only 保存（analysis_type=VEHICLE_RECOGNITION）。
  - `.env` に ANTHROPIC_API_KEY が必要（未設定でも Step1/2 の手入力は動く）。
  - 残り（後回し）: メーターOCR（走行距離）、重複・同一車両検出。
canon対応: Phase 4（の最小版）

### Step 4 — 信頼を見せる・公開する
作るもの: TrustScore の表示（証拠ベース：写真あり/書類あり/VIN確認…でレベルが上がる）
/ `/passport/[vehicleId]` 公開パスポート
完了条件: その車の信頼度と歴史が、URLひとつで第三者に見せられる
canon対応: Phase 5 + Passport

### Step 5 以降 — 後で（今は予約席のまま）
Marketplace（売買）/ Dream Garage（探し）/ Partner（外部業者・課金）/
Notification（LINE・WhatsApp）/ Global（多言語・多通貨・多国法規）。
DBの設計は確定済みなので、必要になった時に該当テーブルとUIを足す。
canon対応: Phase 6〜12

V1で作らないもの（Future Ideas 送り）:
AR / VR / 3D / Digital Twin / Blockchain / Museum / Foundation / Insurance AI / Investment AI

---

## 7. AIの立ち位置（誤解しやすいので明記）

原則: Photo First → AI Second → Human Confirmation。
写真が主役、AIは補助、最終判断は人。AIは断定せず証拠を見せる。

つまり AI は「後から足す便利機能」であって、無くても ARIOS は成立する。
Step 1〜2 は手入力で完成させ、Step 3 でAIを被せて入力を楽にする、という順序でいい。
だから今の段階でAIの複雑な設計に悩む必要はない。

---

## 8. 今どこ / 次の一手

今ここ: Step 3 の Vehicle Recognition まで完了（2026-07-04）。
- ✅ Step 0 土台: DBスキーマ適用 / Next.js雛形 / Supabase接続 / Storage
- ✅ Step 1 登録して残る: 登録フロー（写真最大10枚）→ 永久Timeline、動作確認済み
- ✅ Step 2 育てる: ログイン / マイガレージ / 履歴追加 / owner連携 + RLS、動作確認済み
- ✅ Step 3(一部) AI下書き: 写真→車種推定でフォーム下書き、append-only保存、動作確認済み

次の一手: Step 4（信頼を見せる・公開する）、または Step 3 の残り（メーターOCR）
- Step 4: TrustScore の表示（証拠ベース）/ 公開パスポートの拡充
- 未着手の宿題: メール送信（本番SMTP）/ ログイン後の登録動線を /garage 起点に統一 /
  Step1で作った owner なし車両の「あとから紐付け（claim）」/ AIコスト監視。

進め方の指針:
1つのStepが完全に動いてから次へ。Stepの途中で先の機能に手を出さない。
新しいアイデアはV1に足さず「Future Ideas」としてメモに退避する。
