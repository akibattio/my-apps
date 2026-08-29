// 売り手の並び順（既定は販売価格の安い順。管理者が上書きした priority を優先）。
// 小さいほど上位。priority 未設定は価格順にフォールバック。
export function sellerOrder<T extends { price: number | null; priority: number | null }>(
  a: T,
  b: T
): number {
  const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
  const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  const xa = a.price ?? Number.MAX_SAFE_INTEGER;
  const xb = b.price ?? Number.MAX_SAFE_INTEGER;
  return xa - xb;
}
