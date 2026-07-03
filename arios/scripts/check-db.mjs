// 読み取り専用の疎通確認。SUPABASE_DB_URL に接続し、Phase 1 の中核テーブルと
// 環境変数（アプリ用キー）の設定有無を確認する。破壊的操作は一切しない。
// 使い方: node --env-file=.env scripts/check-db.mjs
import pg from "pg";

const CORE_TABLES = [
  "owners",
  "vehicles",
  "ownerships",
  "histories",
  "documents",
  "images",
  "ai_analyses",
  "trust_scores",
  "audit_logs",
];

const APP_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

console.log("--- アプリ用環境変数 ---");
for (const k of APP_ENV_KEYS) {
  const v = process.env[k];
  console.log(`${k}: ${v && v.trim() ? "設定済み" : "未設定"}`);
}

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error("\nSUPABASE_DB_URL が未設定です。");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("\n--- DB接続 OK ---");

const { rows } = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_name = any($1)
   order by table_name`,
  [CORE_TABLES]
);
const found = new Set(rows.map((r) => r.table_name));

console.log("\n--- Phase 1 中核テーブル ---");
for (const t of CORE_TABLES) {
  console.log(`${found.has(t) ? "✓" : "✗"} ${t}`);
}
console.log(
  found.size === CORE_TABLES.length
    ? "\n全テーブル存在。Phase 1 スキーマ適用済み。"
    : `\n${CORE_TABLES.length - found.size} 件のテーブルが未作成。migrate を実行してください。`
);

await client.end();
