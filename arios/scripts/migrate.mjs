// Supabase(Postgres) にマイグレーションを適用し、結果を検証する。
// 使い方: .env に SUPABASE_DB_URL を設定して `npm run migrate`
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const DB_URL = process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error(
    "SUPABASE_DB_URL が未設定です。.env に Supabase の接続文字列を設定してください。"
  );
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }, // Supabase は SSL 必須
});

async function main() {
  await client.connect();
  console.log("接続OK。マイグレーションを適用します。\n");

  // 適用済みマイグレーションを記録する台帳（未作成なら作る）
  await client.query(
    `create table if not exists schema_migrations (
       filename    text primary key,
       applied_at  timestamptz not null default now()
     )`
  );
  const applied = new Set(
    (await client.query("select filename from schema_migrations")).rows.map(
      (r) => r.filename
    )
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`→ ${file} ... 適用済み（スキップ）`);
      continue;
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    process.stdout.write(`→ ${file} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [
        file,
      ]);
      await client.query("commit");
      console.log("OK");
    } catch (e) {
      await client.query("rollback");
      console.log("失敗");
      console.error(e.message);
      process.exit(1);
    }
  }

  // 検証: 作られたテーブルと enum を確認
  const tables = await client.query(
    `select table_name from information_schema.tables
     where table_schema='public' order by table_name`
  );
  const enums = await client.query(
    `select t.typname from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     group by t.typname order by t.typname`
  );

  console.log("\n--- 作成されたテーブル ---");
  console.log(tables.rows.map((r) => r.table_name).join(", "));
  console.log("\n--- 作成された enum 型 ---");
  console.log(enums.rows.map((r) => r.typname).join(", "));
  console.log("\n完了。");

  await client.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
