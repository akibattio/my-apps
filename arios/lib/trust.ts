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

export function computeTrust(i: TrustInput): TrustResult {
  const reasons: TrustReason[] = [
    { label: "写真がある", met: i.photoCount > 0 },
    { label: "書類がある（車検証・整備記録など）", met: i.documentCount > 0 },
    { label: "車台番号(VIN)が登録されている", met: i.hasVin },
    { label: "履歴が2件以上ある（育っている）", met: i.historyCount >= 2 },
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
  let levelLabel = "自己申告";
  if (i.photoCount > 0) {
    levelIndex = 1;
    level = "LEVEL_1_PHOTO_CONFIRMED";
    levelLabel = "写真で確認";
  }
  if (i.documentCount > 0) {
    levelIndex = 2;
    level = "LEVEL_2_DOCUMENT_CONFIRMED";
    levelLabel = "書類で確認";
  }
  if (i.hasVin) {
    levelIndex = 3;
    level = "LEVEL_3_VIN_CONFIRMED";
    levelLabel = "車台番号で確認";
  }

  return { score, level, levelLabel, levelIndex, reasons };
}
