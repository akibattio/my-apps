// Cloudflare Pages アドバンスドモード Worker。
// console/ 直下に置くと、全リクエストがこの Worker を通る（静的配信も env.ASSETS 経由）。
// Basic 認証を全リクエスト（index.html / data.json 等）に要求し、機密データを保護する。
// 認証情報は Pages 環境変数 BASIC_USER / BASIC_PASS から読む（コードに実値は置かない）。
// フェイルクローズ：環境変数が未設定なら全拒否。

function unauthorized() {
  return new Response("認証が必要です / Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="sofcom-adops", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

// 定数時間比較（タイミング攻撃対策）
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// 共有ストレージAPI（目標設定・アラート対応・承認をスタッフ間で同期）。KV(STATE)に保存。認証の内側でのみ動く。
const SECTIONS = ["targets", "targetsHistory", "alertOps", "approvals"];
async function handleState(request, env, url) {
  const kv = env.STATE;
  if (!kv) return jsonRes({ error: "kv_unbound" }); // KV未バインド時は空扱い→画面はlocalStorageにフォールバック
  if (request.method === "GET") {
    const out = {};
    for (const s of SECTIONS) {
      const v = await kv.get(s);
      out[s] = v ? JSON.parse(v) : (s === "targetsHistory" ? [] : {});
    }
    return jsonRes(out);
  }
  if (request.method === "PUT") {
    const parts = url.pathname.split("/").filter(Boolean); // ["api","state","<section>"]
    const section = parts[2];
    if (!SECTIONS.includes(section)) return jsonRes({ error: "bad_section" }, 400);
    const body = await request.text();
    try { JSON.parse(body); } catch (e) { return jsonRes({ error: "bad_json" }, 400); }
    if (body.length > 1000000) return jsonRes({ error: "too_large" }, 413);
    await kv.put(section, body);
    return jsonRes({ ok: true });
  }
  return jsonRes({ error: "method" }, 405);
}

export default {
  async fetch(request, env) {
    const USER = env.BASIC_USER;
    const PASS = env.BASIC_PASS;

    // 未設定なら全拒否（誤設定でも機密を露出させない）
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
          const url = new URL(request.url);
          if (url.pathname.startsWith("/api/state")) return handleState(request, env, url);
          return env.ASSETS.fetch(request); // 認証OK → 静的アセットを配信
        }
      }
    }
    return unauthorized();
  },
};
