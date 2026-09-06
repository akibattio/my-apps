"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

// 自分の依頼(売り/買い)を修正更新する。本人のメールと一致する行のみ更新可。
export async function updateMyListing(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const email = (user.email ?? "").toLowerCase();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/mypage");

  const supabase = createAdminClient();
  // 本人確認: この依頼のメールがログイン中のメールと一致するか。
  const { data: row } = await supabase
    .from("inquiries")
    .select("id, email")
    .eq("id", id)
    .maybeSingle();
  if (!row || (row.email ?? "").toLowerCase() !== email) redirect("/mypage");

  const priceRaw = String(formData.get("price") ?? "").replace(/[,\s¥円]/g, "").trim();
  const price = priceRaw && /^\d+$/.test(priceRaw) ? Number(priceRaw) : null;
  const message = String(formData.get("message") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;

  await supabase
    .from("inquiries")
    .update({ price, message, contact, name, updated_at: new Date().toISOString() })
    .eq("id", id);

  redirect("/mypage");
}
