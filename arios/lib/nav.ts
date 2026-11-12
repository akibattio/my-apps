// リダイレクト先(next)を安全な「同一サイト内パス」に限定する。
// オープンリダイレクト対策: "/" 始まり かつ "//" や "\"(バックスラッシュ)・制御文字を含むものは拒否し、
// 最後に new URL(next, origin).origin === origin で自サイトの中だけを通す。
// （new URL は "\" を "/" に正規化し、タブや改行を取り除くため、文字列の検査だけに頼らない）
// origin を渡さないとき（ブラウザ側など）は、仮の origin で同じ判定をする。
const FALLBACK_ORIGIN = "https://same-origin.invalid";

export function safeNext(
  raw: string | null | undefined,
  fallback = "/mypage",
  origin: string = FALLBACK_ORIGIN
): string {
  if (!raw) return fallback;
  const s = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(s)) return fallback; // 制御文字（タブ・改行など）を拒否
  if (!s.startsWith("/")) return fallback; // 絶対URL・スキーム相対を拒否
  if (s.startsWith("//")) return fallback; // //evil.com を拒否
  if (s.includes("\\")) return fallback; // /\evil.com を拒否
  if (s.includes("://")) return fallback; // 念のため
  try {
    if (new URL(s, origin).origin !== new URL(origin).origin) return fallback;
  } catch {
    return fallback;
  }
  return s;
}
