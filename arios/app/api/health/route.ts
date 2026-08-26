import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 軽量な稼働確認のみ。テーブル名・件数・DBエラー詳細・環境変数の状態などの
// 内部情報は返さない（偵察情報の露出を防ぐ）。
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true });
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
