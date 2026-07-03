import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Supabase 接続 & Phase 1 スキーマ存在の確認用エンドポイント。
// service_role で各中核テーブルの件数を取り、テーブルが存在するかを検証する。
// 開発中の疎通確認用。認証を Phase 2 で入れる際に公開範囲を見直す。
export const dynamic = "force-dynamic";

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
] as const;

export async function GET() {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { ok: false, stage: "env", error: (e as Error).message },
      { status: 500 }
    );
  }

  const tables: Record<string, { ok: boolean; count?: number; error?: string }> =
    {};
  let allOk = true;

  for (const table of CORE_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      allOk = false;
      tables[table] = { ok: false, error: error.message };
    } else {
      tables[table] = { ok: true, count: count ?? 0 };
    }
  }

  return NextResponse.json(
    {
      ok: allOk,
      message: allOk
        ? "Supabase 接続OK。Phase 1 の中核テーブルが全て存在します。"
        : "一部テーブルにアクセスできません。マイグレーション適用状況を確認してください。",
      tables,
    },
    { status: allOk ? 200 : 500 }
  );
}
