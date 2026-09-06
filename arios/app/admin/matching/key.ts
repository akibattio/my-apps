// マッチング詳細ページのURLキー（メーカー×車種）を安全に符号化/復号する。
// メーカー名・車種名に記号が含まれてもURLで壊れないよう base64url を使う。
export function matchKey(maker: string, model: string): string {
  return Buffer.from(`${maker}\n${model}`, "utf8").toString("base64url");
}

export function parseMatchKey(key: string): { maker: string; model: string } {
  try {
    const s = Buffer.from(key, "base64url").toString("utf8");
    const i = s.indexOf("\n");
    if (i < 0) return { maker: s, model: "" };
    return { maker: s.slice(0, i), model: s.slice(i + 1) };
  } catch {
    return { maker: "", model: "" };
  }
}
