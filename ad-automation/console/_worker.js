// Cloudflare Pages アドバンスドモード Worker。
// console/ 直下に置くと、全リクエストがこの Worker を通る（静的配信も env.ASSETS 経由）。
// 全リクエスト（index.html / data.json 等）に認証を要求し、機密データを保護する。
// - 人（ブラウザ）：Google ログイン（@ALLOWED_HD のアカウントだけ）。ログイン状態は署名付きクッキーで SESSION_TTL_H 時間保つ
//   （修正依頼#16「ベーシック認証が毎回出るのをなくしたい」→ 2026-11-25 秋葉さん判断で Google ログイン）。
//   Pages 環境変数 GOOGLE_LOGIN_CLIENT_ID / GOOGLE_LOGIN_CLIENT_SECRET / SESSION_SECRET が揃ったときだけ有効。
// - 仕組み（手元のスクリプト等）：共有の BASIC_USER / BASIC_PASS を Authorization ヘッダーで送れば通す（裏口・画面では聞かない）。
//   Google ログインの設定が無い間は、従来どおりブラウザにもベーシック認証を出す。
// 秘密の実値はコードに置かない。フェイルクローズ：BASIC_USER / BASIC_PASS が未設定なら全拒否。

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

// ---- Google ログイン（Report GLASS と同じ作り）----
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uStr = (str) => b64u(new TextEncoder().encode(str));
const fromB64u = (s) => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return decodeURIComponent(escape(atob(t + "===".slice((t.length + 3) % 4)))); };
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
function cookies(request) {
  const o = {};
  (request.headers.get("Cookie") || "").split(";").forEach((kv) => { const i = kv.indexOf("="); if (i > 0) o[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
  return o;
}
const COOKIE_FLAGS = "Path=/; HttpOnly; SameSite=Lax; Secure";
function googleLoginOn(env) { return !!(env.GOOGLE_LOGIN_CLIENT_ID && env.GOOGLE_LOGIN_CLIENT_SECRET && env.SESSION_SECRET); }
const allowedHd = (env) => String(env.ALLOWED_HD || "sofcom.co.jp").toLowerCase();
async function readSession(request, env) {
  const c = cookies(request).adops_sess;
  if (!c || !c.includes(".")) return null;
  const [body, sig] = c.split(".");
  if (!(await safeEqual(sig, await hmac(env.SESSION_SECRET, "sess." + body)))) return null;
  try {
    const o = JSON.parse(fromB64u(body));
    return typeof o.e === "string" && o.e.toLowerCase().endsWith("@" + allowedHd(env)) && typeof o.x === "number" && o.x > Date.now() ? o : null;
  } catch (e) { return null; }
}
function loginPage(env, err) {
  const hd = allowedHd(env);
  const msg = err === "domain" ? `@${hd} のアカウントでログインしてください。` : err ? "ログインに失敗しました。もう一度お試しください。" : "";
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>広告運用コンソール ログイン</title>
<style>body{margin:0;font-family:system-ui,-apple-system,"Hiragino Sans",sans-serif;background:#eef4f7;display:flex;min-height:100vh;align-items:center;justify-content:center}
.box{background:#fff;border-radius:16px;box-shadow:0 2px 10px rgba(16,42,31,.08);padding:36px 40px;text-align:center;max-width:360px}
h1{font-size:20px;margin:0 0 6px;color:#0e3a46}.sub{color:#64748b;font-size:13px;margin:0 0 22px}.err{color:#b91c1c;font-size:13px;margin-bottom:14px}
.btn{display:inline-block;background:#0891b2;color:#fff;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:10px}.dom{color:#94a3b8;font-size:12px;margin-top:14px}</style></head>
<body><div class="box"><h1>広告運用コンソール</h1><p class="sub">ソフトコミュニケーションズ 社内用</p>${msg ? `<div class="err">${msg}</div>` : ""}<a class="btn" href="/auth/google">Googleでログイン</a><p class="dom">@${hd} のアカウント限定</p></div></body></html>`,
    { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
const redirect = (to, setCookies) => {
  const h = new Headers({ Location: to, "Cache-Control": "no-store" });
  (setCookies || []).forEach((c) => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
};
async function handleAuth(request, env, url) {
  const origin = url.origin;
  if (url.pathname === "/auth/google") {
    const nonce = b64u(crypto.getRandomValues(new Uint8Array(18)));
    const au = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    au.searchParams.set("client_id", env.GOOGLE_LOGIN_CLIENT_ID);
    au.searchParams.set("redirect_uri", origin + "/auth/callback");
    au.searchParams.set("response_type", "code");
    au.searchParams.set("scope", "openid email");
    au.searchParams.set("hd", allowedHd(env));
    au.searchParams.set("prompt", "select_account");
    au.searchParams.set("state", nonce);
    return redirect(au.toString(), [`adops_state=${nonce}.${await hmac(env.SESSION_SECRET, "state." + nonce)}; ${COOKIE_FLAGS}; Max-Age=600`]);
  }
  if (url.pathname === "/auth/callback") {
    const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
    const [n, sig] = String(cookies(request).adops_state || "").split(".");
    const clear = `adops_state=; ${COOKIE_FLAGS}; Max-Age=0`;
    if (!code || !n || n !== state || !(await safeEqual(sig || "", await hmac(env.SESSION_SECRET, "state." + n)))) return loginPage(env, "fail");
    let claims = null;
    try {
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_LOGIN_CLIENT_ID, client_secret: env.GOOGLE_LOGIN_CLIENT_SECRET,
          redirect_uri: origin + "/auth/callback", grant_type: "authorization_code" }),
      });
      const tj = await tr.json();
      // id_token は Google のトークン窓口から TLS で直接受け取ったもの（第三者を経由しない）なので、中身の項目を確かめて使う
      if (tr.ok && tj.id_token) claims = JSON.parse(fromB64u(tj.id_token.split(".")[1]));
    } catch (e) { claims = null; }
    if (!claims) return loginPage(env, "fail");
    const email = String(claims.email || "").toLowerCase(), hd = allowedHd(env);
    const okIss = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    if (!okIss || claims.aud !== env.GOOGLE_LOGIN_CLIENT_ID || !(claims.exp * 1000 > Date.now())) return loginPage(env, "fail");
    if (claims.email_verified !== true || !email.endsWith("@" + hd) || String(claims.hd || "").toLowerCase() !== hd) return loginPage(env, "domain");
    const ttlH = Number(env.SESSION_TTL_H || 168);
    const body = b64uStr(JSON.stringify({ e: email, x: Date.now() + ttlH * 3600 * 1000 }));
    return redirect("/", [clear, `adops_sess=${body}.${await hmac(env.SESSION_SECRET, "sess." + body)}; ${COOKIE_FLAGS}; Max-Age=${ttlH * 3600}`]);
  }
  if (url.pathname === "/auth/logout") return redirect("/auth/login", [`adops_sess=; ${COOKIE_FLAGS}; Max-Age=0`]);
  return loginPage(env, url.searchParams.get("err") || "");
}

// ---- Report GLASS のレポートの読み取り（各社ページの「成果」に、Report GLASS と同じレポートをチャネルのタブで出す）----
// ログイン済みの人にだけ、Report GLASS の読み取り口（/console-export/・合言葉 RG_CONSOLE_TOKEN）から読んだものを /rg/... として返す。
// 同じサイトの中に置くので、画面側から枠の中のタブを押せる。読めるのは各社レポートの画面・月のデータ・月の一覧だけ。
async function handleRg(request, env, url) {
  if (request.method !== "GET") return jsonRes({ error: "method" }, 405);
  const m = url.pathname.match(/^\/rg\/([a-z0-9-]+)\/(index\.html|months|data\/\d{4}-\d{2}\.js)$/);
  if (!m || !SLUG_RE.test(m[1])) return jsonRes({ error: "not_found" }, 404);
  if (!env.RG_CONSOLE_TOKEN) return jsonRes({ error: "rg_not_configured" }, 503);
  const base = String(env.RG_URL || "https://report-glass.onrender.com").replace(/\/+$/, "");
  let r;
  try {
    r = await fetch(`${base}/console-export/${m[1]}/${m[2]}`, { headers: { "x-adops-console-token": env.RG_CONSOLE_TOKEN }, redirect: "manual" });
  } catch (e) { return jsonRes({ error: "rg_unreachable" }, 502); }
  if (r.status !== 200) return jsonRes({ error: "rg_" + r.status }, r.status === 404 ? 404 : 502);
  const type = m[2] === "index.html" ? "text/html; charset=utf-8" : m[2] === "months" ? "application/json" : "text/javascript; charset=utf-8";
  return new Response(r.body, { status: 200, headers: { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
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

    const url = new URL(request.url);
    const gl = googleLoginOn(env);
    if (gl) {
      if (url.pathname.startsWith("/auth/")) return handleAuth(request, env, url);
      if (await readSession(request, env)) {
        if (url.pathname.startsWith("/api/state")) return handleState(request, env, url);
        if (url.pathname.startsWith("/rg/")) return handleRg(request, env, url);
        return env.ASSETS.fetch(request);
      }
    }
    const header = request.headers.get("Authorization") || "";
    // ヘッダーが無い＝ブラウザ。Google ログインが有効ならログイン画面へ、無効なら従来どおりベーシック認証の入力欄を出す（失敗に数えない）
    if (!header) return gl ? (url.pathname.startsWith("/api/") ? jsonRes({ error: "login_required" }, 401) : redirect("/auth/login")) : unauthorized();
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
          if (url.pathname.startsWith("/api/state")) return handleState(request, env, url);
          // Report GLASS のレポート（全社の会社名・広告費・コメント）は、会社の Google ログインの人だけ（2026-11-25 秋葉さん裁定）。
          // 共有のパスワード（仕組み用の裏口）では中継しない。Report GLASS 自体も Google ログインでしか読めないのに合わせる。
          if (url.pathname.startsWith("/rg/")) return jsonRes({ error: "rg_google_login_required", message: "Report GLASS のレポートは、会社の Google アカウントでログインした人だけが読めます。" }, 403);
          return env.ASSETS.fetch(request); // 認証OK → 静的アセットを配信
        }
      }
    }
    await addFail(env, ip, fails);
    // Google ログインが有効なら、ベーシック認証の入力欄は出さない（仕組み用の裏口なので 401 だけ返す）
    return gl ? jsonRes({ error: "unauthorized" }, 401) : unauthorized();
  },
};
