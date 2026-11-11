// 証拠ベースの TrustScore（信頼度）を計算する純粋関数。
// 原則（Database Design v1.0）: TrustScore は証拠ベース。写真・書類・VIN・履歴の充実で上がる。
// verificationLevel は LEVEL_0_SELF_REPORTED 〜 LEVEL_6_MANUFACTURER_CONFIRMED の7段階。
// V1 では手元の証拠で到達できる LEVEL_0〜3 を扱う（Partner/Manufacturer 確認は後Phase）。

export type TrustInput = {
  photoCount: number;
  documentCount: number;
  hasVin: boolean;
  historyCount: number;
};

export type TrustReason = { label: string; met: boolean };

export type TrustResult = {
  score: number; // 0-100
  level: string; // verification_level enum 値
  levelLabel: string; // 日本語表示
  levelIndex: number; // 0-3
  reasons: TrustReason[];
};

const LABELS = {
  ja: {
    photo: "写真がある",
    doc: "書類がある（車検証・整備記録など）",
    vin: "車体番号が登録されている",
    hist: "記録が2件以上ある（育っている）",
    l0: "自己申告",
    l1: "写真あり",
    l2: "書類あり",
    l3: "車体番号あり",
  },
  en: {
    photo: "Has photos",
    doc: "Has documents (registration, service records, etc.)",
    vin: "VIN is registered",
    hist: "Has 2 or more records",
    l0: "Self-reported",
    l1: "Photos",
    l2: "Documents",
    l3: "VIN registered",
  },
};

export function computeTrust(i: TrustInput, lang: "ja" | "en" = "ja"): TrustResult {
  const L = LABELS[lang];
  const reasons: TrustReason[] = [
    { label: L.photo, met: i.photoCount > 0 },
    { label: L.doc, met: i.documentCount > 0 },
    { label: L.vin, met: i.hasVin },
    { label: L.hist, met: i.historyCount >= 2 },
  ];

  let score = 0;
  if (i.photoCount > 0) score += 30;
  if (i.documentCount > 0) score += 30;
  if (i.hasVin) score += 25;
  score += Math.min(i.historyCount, 3) * 5; // 履歴の充実度（最大15）
  score = Math.min(score, 100);

  // 到達している最上位の証拠段階をレベルとする
  let levelIndex = 0;
  let level = "LEVEL_0_SELF_REPORTED";
  let levelLabel = L.l0;
  if (i.photoCount > 0) {
    levelIndex = 1;
    level = "LEVEL_1_PHOTO_CONFIRMED";
    levelLabel = L.l1;
  }
  if (i.documentCount > 0) {
    levelIndex = 2;
    level = "LEVEL_2_DOCUMENT_CONFIRMED";
    levelLabel = L.l2;
  }
  if (i.hasVin) {
    levelIndex = 3;
    level = "LEVEL_3_VIN_CONFIRMED";
    levelLabel = L.l3;
  }

  return { score, level, levelLabel, levelIndex, reasons };
}
