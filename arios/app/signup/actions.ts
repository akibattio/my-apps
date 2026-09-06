"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export type SignupResult = { error?: "invalid" | "exists" | "failed" | "ratelimited" };

export type SignupProfile = {
  name?: string;
  company?: string;
  contact?: string;
  contactMethod?: string;
};

// お客様の新規登録。確認メールに頼らず、サーバー側で「確認済みユーザー」として作成する。
// （メール配信(SMTP/DNS)が未整備でも登録が通る。ログインはこの後クライアントで行う。）
// プロフィール(名前/会社名/連絡先)は user_metadata に保存し、売り/買いフォームに反映する。
export async function signUpCustomer(
  email: string,
  password: string,
  profile: SignupProfile = {}
): Promise<SignupResult> {
  const em = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { error: "invalid" };
  if (!password || password.length < 6) return { error: "invalid" };

  // レート制限（IP単位・ベストエフォート。本番は共有ストア推奨）。
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const rl = rateLimit(`signup:${ip}`, 5, 60_000);
  const rlDay = rateLimit(`signup:day:${ip}`, 30, 24 * 60 * 60_000);
  if (!rl.ok || !rlDay.ok) return { error: "ratelimited" };

  // 管理者メールは会員登録で作成させない（成りすまし防止）。管理者は別経路で発行。
  if (getAdminEmails().includes(em)) return { error: "failed" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: em,
    password,
    email_confirm: true, // 確認メールを送らず、確認済みで作成
    user_metadata: {
      name: (profile.name ?? "").trim() || null,
      company: (profile.company ?? "").trim() || null,
      contact: (profile.contact ?? "").trim() || null,
      contact_method: (profile.contactMethod ?? "").trim() || null,
    },
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
