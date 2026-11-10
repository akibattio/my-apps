// 読み込みに失敗したとき、空の一覧（「0件」「まだ登録がありません」）や「見つかりません」と
// 見せないための共通チェック。エラーなら例外にして app/error.tsx のエラー画面を出す。
// 2026-11-09 に PostgREST が止まり、本番が約15分「0件」と表示された件の再発防止。
export function throwIfDbError(
  error: { message?: string; code?: string } | null | undefined,
  where: string
): void {
  if (!error) return;
  console.error(`[db] read failed at ${where}:`, error);
  throw new Error(`DB_READ_FAILED: ${where}`);
}
