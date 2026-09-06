// 賢いマッチングの判定ロジック（管理画面/一覧の双方から参照する共有モジュール）。
// 価格(予算 vs 売値)を軸に、さらに色・事故車などの条件も加味して
// 成立可能性を Strong / Possible / Low で判定する。
export type Grade = "STRONG" | "POSSIBLE" | "LOW";

export const GRADE_LABEL: Record<Grade, string> = {
  STRONG: "有力",
  POSSIBLE: "候補",
  LOW: "要検討",
};

// バッジ配色。STRONG=緑 / POSSIBLE=金(primary) / LOW=控えめ。
export const GRADE_STYLE: Record<Grade, string> = {
  STRONG: "text-emerald-300 bg-emerald-400/10",
  POSSIBLE: "text-primary bg-primary/10",
  LOW: "text-muted bg-white/5",
};

export const GRADE_RANK: Record<Grade, number> = { STRONG: 0, POSSIBLE: 1, LOW: 2 };
const GRADE_BY_RANK: Grade[] = ["STRONG", "POSSIBLE", "LOW"];

const yen = (n: number) => "¥" + Number(n).toLocaleString("ja-JP");

// 色マッチ判定に使う代表的な色語。
const KNOWN_COLORS = [
  "赤", "白", "黒", "青", "銀", "シルバー", "グレー", "灰", "紺", "黄",
  "緑", "茶", "タン", "ベージュ", "紫", "オレンジ", "ゴールド", "パール",
];

type Party = { price: number | null; message: string | null };

// 価格だけで成立可能性を判定（一覧の簡易表示用にも使う）。
export function gradePair(
  budget: number | null,
  price: number | null
): { grade: Grade; reason: string } {
  if (price == null) return { grade: "POSSIBLE", reason: "売値が未定（要確認）" };
  if (budget == null) return { grade: "POSSIBLE", reason: "予算が未定（要確認）" };

  if (price <= budget) {
    const under = budget - price;
    return {
      grade: "STRONG",
      reason:
        under > 0
          ? `売値 ${yen(price)} が予算内（予算より ${yen(under)} 安い）`
          : `売値 ${yen(price)} が予算ぴったり`,
    };
  }

  const over = price - budget;
  const pct = Math.round((price / budget - 1) * 100);
  if (price <= budget * 1.1) {
    return { grade: "POSSIBLE", reason: `予算+${pct}%（${yen(over)} 高い）・交渉余地あり` };
  }
  if (price <= budget * 1.25) {
    return { grade: "LOW", reason: `予算+${pct}%（${yen(over)} 高い）` };
  }
  return { grade: "LOW", reason: `予算を大きく超過（+${pct}%・${yen(over)} 高い）` };
}

// 買い手のこだわり条件を message から読み取る（買いフォームが message に整形して保存している）。
export function parseBuyerConditions(message: string | null): {
  accidentNG: boolean;
  color: string | null;
} {
  const m = message ?? "";
  const accidentNG = m.includes("事故車NG") || m.includes("事故NG");
  const cm = m.match(/カラー[:：]\s*([^\/／]+)/);
  const color = cm ? cm[1].trim() : null;
  return { accidentNG, color };
}

// 買い手条件と売り手情報(message)を突き合わせ、ペナルティ(段階の下げ幅)と理由を返す。
function conditionCheck(
  cond: { accidentNG: boolean; color: string | null },
  sellerMessage: string | null
): { penalty: number; reasons: string[] } {
  const sm = sellerMessage ?? "";
  const reasons: string[] = [];
  let penalty = 0;

  // 事故車NG なのに売り手情報に「事故」の記載 → 大きく下げる
  if (cond.accidentNG && /事故/.test(sm)) {
    penalty += 2;
    reasons.push("⚠ 売り手情報に「事故」の記載（買い手は事故車NG）");
  }

  // 色の希望
  if (cond.color) {
    const wanted = KNOWN_COLORS.filter((c) => cond.color!.includes(c));
    if (wanted.length) {
      if (wanted.some((c) => sm.includes(c))) {
        reasons.push(`色: ${cond.color} が一致`);
      } else {
        const other = KNOWN_COLORS.find((c) => sm.includes(c) && !wanted.includes(c));
        if (other) {
          penalty += 1;
          reasons.push(`色違いの可能性（希望: ${cond.color} / 売り手: ${other}）`);
        }
        // 売り手情報に色の記載が無ければ判断不可＝ペナルティなし
      }
    }
  }

  return { penalty, reasons };
}

// 価格＋条件を総合した判定。理由は複数行返す。
export function gradePairFull(
  buyer: Party,
  seller: Party
): { grade: Grade; reasons: string[] } {
  const base = gradePair(buyer.price, seller.price);
  const cond = parseBuyerConditions(buyer.message);
  const { penalty, reasons } = conditionCheck(cond, seller.message);
  const rank = Math.min(2, GRADE_RANK[base.grade] + penalty);
  return { grade: GRADE_BY_RANK[rank], reasons: [base.reason, ...reasons] };
}

// グループ内の全ペアから最も高い成立可能性を返す（一覧のバッジ用）。価格＋条件を加味。
export function bestGradeFull(buyers: Party[], sellers: Party[]): Grade | null {
  if (buyers.length === 0 || sellers.length === 0) return null;
  let best: Grade | null = null;
  for (const b of buyers) {
    for (const s of sellers) {
      const { grade } = gradePairFull(b, s);
      if (best == null || GRADE_RANK[grade] < GRADE_RANK[best]) best = grade;
    }
  }
  return best;
}
