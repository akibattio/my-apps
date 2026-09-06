// 賢いマッチングの判定ロジック（管理画面/一覧の双方から参照する共有モジュール）。
// まずは「価格(予算 vs 売値)」を軸に成立可能性を Strong / Possible / Low で判定する。
// 色・状態などの細かい条件は自由記述のため、確定判定はせず「要確認」として補足する。
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

const yen = (n: number) => "¥" + Number(n).toLocaleString("ja-JP");

// 買い手の予算と売り手の売値から成立可能性を判定し、理由を返す。
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

// グループ内の全ペアから最も高い成立可能性を返す（一覧のバッジ用）。
export function bestGrade(
  budgets: (number | null)[],
  prices: (number | null)[]
): Grade | null {
  if (budgets.length === 0 || prices.length === 0) return null;
  let best: Grade | null = null;
  for (const b of budgets) {
    for (const p of prices) {
      const { grade } = gradePair(b, p);
      if (best == null || GRADE_RANK[grade] < GRADE_RANK[best]) best = grade;
    }
  }
  return best;
}
