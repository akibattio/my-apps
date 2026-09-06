"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type SignupResult = { error?: "invalid" | "exists" | "failed" };

// お客様の新規登録。確認メールに頼らず、サーバー側で「確認済みユーザー」として作成する。
// （メール配信(SMTP/DNS)が未整備でも登録が通る。ログインはこの後クライアントで行う。）
export async function signUpCustomer(
  email: string,
  password: string
): Promise<SignupResult> {
  const em = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { error: "invalid" };
  if (!password || password.length < 6) return { error: "invalid" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: em,
    password,
    email_confirm: true, // 確認メールを送らず、確認済みで作成
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const code = (error as { code?: string }).code ?? "";
    if (code === "email_exists" || msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { error: "exists" };
    }
    console.error("[signup] createUser failed:", error);
    return { error: "failed" };
  }
  return {};
}
