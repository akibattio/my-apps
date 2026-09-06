// リダイレクト先(next)を安全な「同一サイト内パス」に限定する。
// オープンリダイレクト対策: "/" 始まり かつ "//" や "\"(バックスラッシュ)を含むものは拒否。
// （new URL は "\" を "/" に正規化するため、バックスラッシュ経由の外部遷移を防ぐ）
export function safeNext(raw: string | null | undefined, fallback = "/mypage"): string {
  if (!raw) return fallback;
  const s = raw.trim();
  if (!s.startsWith("/")) return fallback; // 絶対URL・スキーム相対を拒否
  if (s.startsWith("//")) return fallback; // //evil.com を拒否
  if (s.includes("\\")) return fallback; // /\evil.com を拒否
  if (s.includes("://")) return fallback; // 念のため
  return s;
}
