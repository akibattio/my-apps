// Cloudflare Pages Functions middleware.
// 全リクエスト（index.html / data.json など静的アセット含む）に Basic 認証を要求する。
// 認証情報は Pages の環境変数 BASIC_USER / BASIC_PASS から読む（コードに実値は置かない）。
// フェイルクローズ：環境変数が未設定なら全て拒否する（誤設定でも機密を露出させない）。

function unauthorized() {
  return new Response("認証が必要です / Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="sofcom-adops", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

// タイミング攻撃を避けるための定数時間比較
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const onRequest = async (context) => {
  const { request, env, next } = context;
  const USER = env.BASIC_USER;
  const PASS = env.BASIC_PASS;

  // 未設定なら全拒否（フェイルクローズ）
  if (!USER || !PASS) {
    return new Response("Auth not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch (e) {
      return unauthorized();
    }
    const idx = decoded.indexOf(":");
    if (idx !== -1) {
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (safeEqual(u, USER) && safeEqual(p, PASS)) {
        return next(); // 認証OK → 通常のコンテンツを配信
      }
    }
  }
  return unauthorized();
};
