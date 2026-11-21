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

// 固定時間の比較（タイミング攻撃対策）。両方を SHA-256 にしてから比べるので、長さの違いも時間に出ない。
async function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

// 認証の失敗回数の制限：同じ接続元から 15分に 10回失敗したら、その後 15分は 429 で断る。
// 失敗回数は KV（STATE）に期限付きで持つ（Worker のメモリは複数の実行環境で共有されないため）。KV が無いときはメモリで代用。
const FAIL_LIMIT = 10, FAIL_WINDOW_SEC = 900;
const memFails = new Map();
async function failCount(env, ip) {
  if (env.STATE) return parseInt((await env.STATE.get(`authfail:${ip}`)) || "0", 10) || 0;
  const e = memFails.get(ip);
  return e && e.until > Date.now() ? e.n : 0;
}
async function addFail(env, ip, n) {
  if (env.STATE) return env.STATE.put(`authfail:${ip}`, String(n + 1), { expirationTtl: FAIL_WINDOW_SEC });
  memFails.set(ip, { n: n + 1, until: Date.now() + FAIL_WINDOW_SEC * 1000 });
}

function jsonRes(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ---- 保存内容の検査（サーバー側）----
// 画面の入力チェックは手を加えれば迂回できるので、保存の入口でも形（項目・型・長さ・件数）を検査する。
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/; // 識別名：英小文字・数字・ハイフン（ファイル名の一部になる）
const ID_RE = /^[0-9]{1,20}$/;
const MEDIA = ["yahoo_search", "yahoo_display", "microsoft"];
// 媒体ごとの番号の桁。2026-11-21 に、名簿の実物（Yahoo!検索7桁・ディスプレイ10桁）と Microsoft の API の口座一覧（口座・顧客とも9桁）で確かめた形に、少し幅を持たせた。
// 別の媒体の番号の入れ間違い（例: Yahoo!検索の7桁を Microsoft の顧客IDに入れる）を保存の前に止める。
const ID_SHAPE = { yahoo_search: /^[0-9]{7,8}$/, yahoo_display: /^[0-9]{10}$/, microsoft: /^[0-9]{8,10}$/ };
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => typeof v === "string" && v.length <= max;

// 目標・承認・アラート対応・予算・目標の履歴：中身の項目は画面側で増えるので、形の上限だけを見る
function checkGeneric(v, depth) {
  if (depth > 6) return "too_deep";
  if (v === null || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? null : "bad_number";
  if (typeof v === "string") return v.length <= 2000 ? null : "too_long";
  if (Array.isArray(v)) {
    if (v.length > 5000) return "too_many";
    for (const x of v) { const e = checkGeneric(x, depth + 1); if (e) return e; }
    return null;
  }
  if (isObj(v)) {
    const ks = Object.keys(v);
    if (ks.length > 2000) return "too_many";
    for (const k of ks) {
      if (k.length > 200) return "key_too_long";
      const e = checkGeneric(v[k], depth + 1); if (e) return e;
    }
    return null;
  }
  return "bad_type";
}

function checkMediaAccounts(next, prev, confirmSlug) {
  if (!isObj(next) || !Array.isArray(next.list)) return "bad_shape";
  if (next.list.length > 200) return "too_many";
  const allowed = new Set(["client", "media", "accountId", "customerId", "slug", "addedBy", "addedAt"]);
  const keys = new Set();
  // 桁の形は、新しく足す口座にだけ当てる（前からある口座で一覧ごと保存できなくなり、外すこともできなくなるのを避ける）
  const prevKeys = new Set((isObj(prev) && Array.isArray(prev.list) ? prev.list : []).filter(isObj).map((x) => `${x.media}|${x.accountId}|${x.customerId || ""}`));
  for (const e of next.list) {
    if (!isObj(e)) return "bad_entry";
    for (const k of Object.keys(e)) if (!allowed.has(k)) return `unknown_field:${k}`.slice(0, 40);
    if (!str(e.client, 80) || !e.client.trim()) return "bad_client";
    if (!MEDIA.includes(e.media)) return "bad_media";
    if (typeof e.accountId !== "string" || !ID_RE.test(e.accountId)) return "bad_account_id";
    if (e.media === "microsoft" ? !(typeof e.customerId === "string" && ID_RE.test(e.customerId))
                                : !(e.customerId === undefined || e.customerId === "")) return "bad_customer_id";
    if (!(e.slug === undefined || e.slug === "" || (typeof e.slug === "string" && SLUG_RE.test(e.slug)))) return "bad_slug";
    if (!(e.addedBy === undefined || str(e.addedBy, 40))) return "bad_added_by";
    if (!(e.addedAt === undefined || (typeof e.addedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.addedAt)))) return "bad_added_at";
    const key = `${e.media}|${e.accountId}`;
    if (keys.has(key)) return "duplicate_account";
    keys.add(key);
    if (!prevKeys.has(`${key}|${e.customerId || ""}`)) {
      if (!ID_SHAPE[e.media].test(e.accountId)) return "account_id_shape";
      if (e.media === "microsoft" && !ID_SHAPE.microsoft.test(e.customerId)) return "customer_id_shape";
    }
  }
  // 識別名の結び付け：すでにある識別名に、別のアカウントIDを新しく結び付ける変更は、明示の操作（confirmSlug）のときだけ。
  // 同じ識別名は同じ取引先名でなければならない（別の取引先の数字がレポートに混ざるのを防ぐ）。
  const before = new Map(); // slug -> {client, keys:Set}
  for (const e of (isObj(prev) && Array.isArray(prev.list) ? prev.list : [])) {
    if (!isObj(e) || !e.slug) continue;
    const b = before.get(e.slug) || { client: e.client, keys: new Set() };
    b.keys.add(`${e.media}|${e.accountId}`);
    before.set(e.slug, b);
  }
  const owner = new Map();
  for (const e of next.list) {
    if (!e.slug) continue;
    const o = owner.get(e.slug);
    if (o !== undefined && o !== e.client) return "slug_other_client";
    owner.set(e.slug, e.client);
    const b = before.get(e.slug);
    if (!b) continue;
    if (b.client !== e.client) return "slug_other_client";
    const key = `${e.media}|${e.accountId}`;
    if (!b.keys.has(key) && confirmSlug !== e.slug) return "slug_bound";
  }
  return null;
}

// 共有ストレージAPI（目標設定・アラート対応・承認・契約をスタッフ間で同期）。KV(STATE)に保存。認証の内側でのみ動く。
// 2026-07-30: KV名前空間 adops-state を STATE としてバインド済み（全スタッフ共有ON）。
const SECTIONS = ["targets", "targetsHistory", "alertOps", "approvals", "budgets", "mediaAccounts"];
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
    if (parts.length !== 3 || !SECTIONS.includes(section)) return jsonRes({ error: "bad_section" }, 400);
    const body = await request.text();
    if (body.length > 1000000) return jsonRes({ error: "too_large" }, 413);
    let data;
    try { data = JSON.parse(body); } catch (e) { return jsonRes({ error: "bad_json" }, 400); }
    let problem;
    if (section === "mediaAccounts") {
      const prevRaw = await kv.get("mediaAccounts");
      let prev = null;
      try { prev = prevRaw ? JSON.parse(prevRaw) : null; } catch (e) { prev = null; }
      problem = checkMediaAccounts(data, prev, url.searchParams.get("confirmSlug") || "");
    } else if (section === "targetsHistory") {
      problem = Array.isArray(data) ? checkGeneric(data, 0) : "bad_shape";
    } else {
      problem = isObj(data) ? checkGeneric(data, 0) : "bad_shape";
    }
    if (problem) return jsonRes({ error: problem }, problem === "slug_bound" ? 409 : 400);
    await kv.put(section, JSON.stringify(data));
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
    if (!header) return unauthorized(); // 初回（ブラウザが認証の入力欄を出す）は失敗に数えない
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const fails = await failCount(env, ip);
    if (fails >= FAIL_LIMIT) {
      return new Response("試行回数が多すぎます。しばらく待ってからお試しください / Too many attempts", {
        status: 429,
        headers: { "Retry-After": String(FAIL_WINDOW_SEC), "Cache-Control": "no-store" },
      });
    }
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      let decoded = "";
      try {
        decoded = atob(encoded);
      } catch (e) {
        decoded = "";
      }
      const idx = decoded.indexOf(":");
      if (idx !== -1) {
        const u = decoded.slice(0, idx);
        const p = decoded.slice(idx + 1);
        const okU = await safeEqual(u, USER), okP = await safeEqual(p, PASS);
        if (okU && okP) {
          const url = new URL(request.url);
          if (url.pathname.startsWith("/api/state")) return handleState(request, env, url);
          return env.ASSETS.fetch(request); // 認証OK → 静的アセットを配信
        }
      }
    }
    await addFail(env, ip, fails);
    return unauthorized();
  },
};
