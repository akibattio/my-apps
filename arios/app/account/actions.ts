"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";

export type AccountState = { ok?: boolean; error?: string };

// 表示名を更新する（ログインユーザー本人の Owner のみ）。
export async function updateProfile(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  const owner = await ensureOwner();
  if (!owner) return { error: "ログインが必要です。" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "表示名を入力してください。" };
  if (name.length > 60) return { error: "表示名は60文字以内にしてください。" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("owners")
    .update({ name })
    .eq("id", owner.ownerId);

  if (error) return { error: "更新に失敗しました。時間をおいて試してください。" };

  revalidatePath("/account");
  return { ok: true };
}
