# ARIOS Deal OS — 開発ロードマップ / 実行計画

SAM（鈴木）氏の構想を、**実装の実行単位**に整理したもの。
方針：**最初から全部は作らない。まず Phase 1 を実用化。ただし Phase 1 のデータは将来の Vehicle History につながる構造にする。Security/Trust は Phase 1 から要件に含める。**

---

## 0. 北極星（最終目的）

車を **VehicleIdentifier（VIN / Chassis No 等）を中心に一生追跡**し、**BUY / SELL を AI でマッチング**、**安全に取引**し、その取引と所有履歴を **Vehicle History として残し続ける OS**。
「車を通して人生を豊かにする」。仲介を一件ずつやらなくても、Matching / Deal / History / Intelligence からも収益が生まれる循環を作る。

## 1. 二つの Intelligence（データの柱）

- **Lead Intelligence** … 誰が何を買いたい/売りたいか（Buyer/Seller/Wanted/Selling/Budget/Asking/Country/Conditions/Timing/Contact History/Follow-up）。**Lead・Deal は終わっても消える。**
- **Vehicle Intelligence** … その一台が何者か（Identifier/Spec/Ownership/Mileage/Sale/Maintenance/Repair/Accident/Restoration/Modification/Photos/Docs/Auction/Race/Provenance）。**Vehicle は残り続ける。**

## 2. コア設計原則（Phase 1 から守る＝“後から直せない土台”）

1. **One Vehicle = One Continuous History** … 識別子は17桁VINに限定せず、VIN/Chassis/JDM Frame/Race Chassis ID 等に対応（`identifier_type` + `value`）。Owner・国が変わっても同一Vehicleとして継続。
2. **Deal closes, Vehicle continues** … Lead/Deal と Vehicle を分離。売れても Vehicle は残り Ownership を更新。
3. **Source / Verification / Confidence** … すべての情報に「出所」と「検証状態」を持たせる（Owner Reported / Manual / AI・OCR / Document Verified / ARIOS Verified / Unknown）。事実・推測・伝聞を混同しない。
4. **Privacy / Security** … 「必要な人に、必要な情報だけ」。連絡先・価格・交渉・書類は無断で第三者公開しない。Phase 1 から要件。
5. **Low friction 入力** … SELL は理想15秒。写真/スクショ/貼付 → AI抽出 → 不足だけ確認 → 登録。**情報不足を理由に Lead を失わない。**

---

## 3. 現在地（実装済み・2026-08）

- 公開フォーム **`/sell`（売りたい）/`/buy`（買いたい）** … 合言葉なし・ログイン不要。必須=メーカー/車種。売り=区分(オーナー/ブローカー/ディーラー)/販売価格/車体番号/写真最大30枚。買い=希望価格/こだわり条件(事故車NG・カラー・内装色・改造・オプション)/受付経路(LINE/WhatsApp/電話/紹介)。
- 管理画面 … **買いたい人一覧**（受付日・経路・依頼者・希望車・条件）/ **売りたい人一覧**（車ごとに人数・区分・安い順）/ **マッチング**（メーカー×車種でグループ、売り手は安い順、ARIOSが優先順位変更可）。
- **依頼 → 車両登録**（VIN引継ぎ）、車両パスポート/タイムライン（旧）、AI車種推定（社内・写真から）。
- 基盤 … マジックリンク認証、管理者判定、非公開バケット、noindex、レート制限、AI費用上限。

> 実は Phase 1 の骨格（BUY/SELL登録・簡易マッチング・カテゴリー整理）は概ね動いている。次は「取りこぼさない」ための follow-up と「思い出す」AI マッチング、そして将来へつなぐ土台の作り込み。

---

## 4. フェーズ全体像（SAM構想 → 実行順）

| 実行段階 | 内容 | SAM Phase |
|---|---|---|
| **A. Phase 1 完成（今）** | BUY/SELL を取りこぼさない個人Deal OS：高速入力＋AI抽出、follow-up、賢いマッチング | 1 |
| **B. 土台の作り込み（今・並行）** | VehicleIdentifier / Source・Confidence / Person・Lead・Vehicle 分離 を Phase 1 データに仕込む | 2・3・8の前提 |
| **C. AI 取り込み** | Gmail/WhatsApp/LINE/Instagram から候補検出 → AI Suggest → Human Confirm | 2 |
| **D. 外部登録＋段階的本人確認** | 外部Seller/Buyer登録。入口は簡単、取引が進むほど本人/所有/権限確認を強化 | 3 |
| **E. Deal Room ＋ Trust** | Match成立後の専用取引ページ。会話/オファー/合意/権限/振込先を記録し不正を防ぐ | 5・6 |
| **F. 成約→Ownership更新→Vehicle History** | Deal closes, Vehicle continues。履歴画面と検索 | 7・8 |
| **G. マネタイズ** | Matching Fee / Deal Room / History Report / Intelligence / Search / Subscription | 4・9・10 |
| **H. グローバル / Trust Network** | 日本↔海外↔海外、Vehicle Trust Network | 11・12 |

---

## 5. Phase 1 の「完成条件」（今スプリントで作る）

成功条件は“サイトを作ること”ではなく **「今まで忘れていた BUY/SELL から実際の商談が生まれること」**。残りは4点：

- **① Follow-up 管理** … Status（新規/連絡済/商談中/成約/見送り 等）＋ 次アクション日 ＋ 最終接触日 ＋ メモ。案件を忘れない・追える。
- **② AI 取り込み（入力の高速化）**
  - SELL：車両写真・車検証・VIN写真・メーター・**LINE/WhatsApp/メールのスクショ**を投入 → AIが Make/Model/Year/VIN/Mileage/Color/Price 等を抽出 → 不足だけ確認。
  - BUY：チャット/メモを**貼り付け → AIが構造化**（メーカー/モデル/予算/条件）。
- **③ 賢いマッチング** … 完全一致だけでなく、**予算差・色違い・仕様違い**も含め **Strong / Possible / Low** と **マッチ理由** を提示。「この人この車欲しがってたな」を ARIOS に思い出させる。
- **④ 15秒UX** … ②を前提に、入力を最短化。

## 6. Phase 1 のうちに“仕込む”設計（将来の作り直しを防ぐ）

Phase 1 のデータを捨てないために、今のうちに軽く構造を足す（画面は後でOK）：

- **VehicleIdentifier** … リード/車両に `identifier_type`(VIN/CHASSIS/FRAME/RACE_ID/UNKNOWN) + `identifier_value` を持たせ、名寄せの核にする。
- **Source / Verification / Confidence** … 各情報に出所・検証状態・確信度を保持（AI抽出は Confidence 付き）。
- **Person（人）** … Buyer/Seller を「人」として名寄せできる余地を残す（連絡履歴・follow-up の基礎）。
- **Lead ⇄ Vehicle** … SELL Lead が確定したら Vehicle へ接続（実装済みの導線を発展）。

## 7. 推奨する進め方

1. **今**：Phase 1 完成（①follow-up → ②AI取り込み → ③賢いマッチング）＋ ⑥の土台を少しずつ。
2. **次**：F（成約→Ownership→Vehicle History の“つながり”を通す）。
3. **その後**：C（AI取り込み拡張）→ D/E（外部・Deal Room・Trust）→ G（マネタイズ）→ H（グローバル）。

各 Phase は「実データで実際に商談が回るか」で完了判定する。

---

_最終更新: 2026-08-30 ／ この文書が開発の正本（進捗は本ファイルと `docs/DESIGN.md` を参照）。_
