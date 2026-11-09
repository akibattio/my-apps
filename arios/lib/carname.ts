// メーカー名・車種名の表記ゆれをそろえて、マッチ判定に使うキーを作る。サーバー/クライアント共用。
// 例: 「フェラーリ」「Ferrari」「FERRARI」→ 同じメーカー。「SL73 AMG」「SL73AMG」→ 同じ車種。
// 登録された文字はそのまま保存し、比べるときだけこのキーを使う。

type Maker = { en: string; ja: string; aliases?: string[] };

// よく出るメーカー（英語の正式名・日本語表記・別の書き方）。足すときはここに1行。
export const MAKERS: Maker[] = [
  { en: "Ferrari", ja: "フェラーリ" },
  { en: "Lamborghini", ja: "ランボルギーニ" },
  { en: "Porsche", ja: "ポルシェ" },
  { en: "Mercedes-Benz", ja: "メルセデス・ベンツ", aliases: ["メルセデスベンツ", "メルセデス", "ベンツ", "Mercedes", "Benz", "Mercedes-AMG", "メルセデスAMG", "AMG"] },
  { en: "BMW", ja: "BMW", aliases: ["ビーエムダブリュー"] },
  { en: "Audi", ja: "アウディ" },
  { en: "Volkswagen", ja: "フォルクスワーゲン", aliases: ["VW"] },
  { en: "McLaren", ja: "マクラーレン" },
  { en: "Aston Martin", ja: "アストンマーティン", aliases: ["アストンマーチン"] },
  { en: "Bentley", ja: "ベントレー" },
  { en: "Rolls-Royce", ja: "ロールス・ロイス", aliases: ["ロールスロイス"] },
  { en: "Maserati", ja: "マセラティ", aliases: ["マセラッティ"] },
  { en: "Alfa Romeo", ja: "アルファロメオ" },
  { en: "Lancia", ja: "ランチア" },
  { en: "Fiat", ja: "フィアット" },
  { en: "Abarth", ja: "アバルト" },
  { en: "Bugatti", ja: "ブガッティ" },
  { en: "Pagani", ja: "パガーニ" },
  { en: "Koenigsegg", ja: "ケーニグセグ" },
  { en: "De Tomaso", ja: "デ・トマソ", aliases: ["デトマソ"] },
  { en: "Lotus", ja: "ロータス" },
  { en: "Jaguar", ja: "ジャガー" },
  { en: "Land Rover", ja: "ランドローバー", aliases: ["Range Rover", "レンジローバー"] },
  { en: "Mini", ja: "ミニ", aliases: ["BMW Mini"] },
  { en: "Morgan", ja: "モーガン" },
  { en: "Peugeot", ja: "プジョー" },
  { en: "Renault", ja: "ルノー" },
  { en: "Citroën", ja: "シトロエン", aliases: ["Citroen"] },
  { en: "Alpine", ja: "アルピーヌ" },
  { en: "Volvo", ja: "ボルボ" },
  { en: "Ford", ja: "フォード" },
  { en: "Chevrolet", ja: "シボレー", aliases: ["Chevy"] },
  { en: "Dodge", ja: "ダッジ" },
  { en: "Jeep", ja: "ジープ" },
  { en: "Cadillac", ja: "キャデラック" },
  { en: "Shelby", ja: "シェルビー" },
  { en: "Tesla", ja: "テスラ" },
  { en: "Toyota", ja: "トヨタ" },
  { en: "Lexus", ja: "レクサス" },
  { en: "Nissan", ja: "日産", aliases: ["ニッサン", "NISSAN"] },
  { en: "Datsun", ja: "ダットサン" },
  { en: "Infiniti", ja: "インフィニティ" },
  { en: "Honda", ja: "ホンダ" },
  { en: "Acura", ja: "アキュラ" },
  { en: "Mazda", ja: "マツダ" },
  { en: "Subaru", ja: "スバル" },
  { en: "Mitsubishi", ja: "三菱", aliases: ["ミツビシ", "三菱自動車"] },
  { en: "Suzuki", ja: "スズキ" },
  { en: "Daihatsu", ja: "ダイハツ" },
  { en: "Isuzu", ja: "いすゞ", aliases: ["いすず", "イスズ"] },
  { en: "Hyundai", ja: "ヒョンデ", aliases: ["ヒュンダイ"] },
  { en: "Kia", ja: "キア" },
];

// 比較用に文字をそろえる（全角半角・大文字小文字・空白・ハイフン・中黒・ピリオド）。
function fold(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-‐－―−_・·.'’]/g, "")
    .replace(/ë/g, "e");
}

const MAKER_INDEX = (() => {
  const m = new Map<string, Maker>();
  for (const mk of MAKERS) {
    for (const name of [mk.en, mk.ja, ...(mk.aliases ?? [])]) m.set(fold(name), mk);
  }
  return m;
})();

// 既知のメーカーなら英語の正式名を返す。知らないメーカーは入力をそのまま返す。
export function canonicalMaker(raw: string | null | undefined): string {
  const f = fold(raw);
  return MAKER_INDEX.get(f)?.en ?? (raw ?? "").trim();
}

// マッチ判定キー（メーカー×車種）。同じキーなら同じ車として扱う。
export function carKey(maker: string | null | undefined, model: string | null | undefined): string {
  const mk = MAKER_INDEX.get(fold(maker));
  return (mk ? fold(mk.en) : fold(maker)) + "||" + fold(model);
}

// 入力欄の候補（表示言語に合わせた書き方）。
export function makerSuggestions(lang: "ja" | "en"): string[] {
  return MAKERS.map((m) => (lang === "en" ? m.en : m.ja));
}
