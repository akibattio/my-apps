"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAdminEmails } from "@/lib/auth";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";

// status:
//  - "signedIn": 確認メール設定OFF時。即セッション確立（従来どおりの体験）。
//  - "confirm" : 確認メール設定ON時。確認メールを送信。確認するまでログイン不可。
export type SignupResult = {
  status: "signedIn" | "confirm" | "error";
  error?: "invalid" | "exists" | "failed" | "ratelimited" | "captcha";
};

export type SignupProfile = {
  name?: string;
  company?: string;
  contact?: string;
  contactMethod?: string;
};

// 本番のサイトURL。環境変数があれば優先、無ければリクエストヘッダから組み立てる。
function siteOrigin(h: Headers): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && env.trim()) return env.trim().replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// お客様の新規登録。Supabase 標準の signUp を使う。
// Supabase 側の「Confirm email」設定で動作が切り替わる:
//  - OFF: 即セッション確立（メール配信不要・従来どおり）
//  - ON : 確認メールを送信し、確認するまでログイン不可（なりすまし防止）
// プロフィール(名前/会社名/連絡先)は user_metadata(options.data) に保存。
export async function signUpCustomer(
  email: string,
  password: string,
  profile: SignupProfile = {},
  captchaToken?: string
): Promise<SignupResult> {
  const em = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { status: "error", error: "invalid" };
  if (!password || password.length < 6) return { status: "error", error: "invalid" };

  // レート制限（共有ストア=Supabase。全インスタンス共通。IP単位）。
  const h = await headers();
  const ip = clientIp(h);
  const rl = await rateLimitDb(`signup:min:${ip}`, 5, 60_000);
  const rlDay = await rateLimitDb(`signup:day:${ip}`, 30, 24 * 60 * 60_000);
  if (!rl.ok || !rlDay.ok) return { status: "error", error: "ratelimited" };

  // 管理者メールは会員登録で作成させない（成りすまし防止）。管理者は別経路で発行。
  if (getAdminEmails().includes(em)) return { status: "error", error: "failed" };

  const origin = siteOrigin(h);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: em,
    password,
    options: {
      // 確認メールのリンク先。/auth/callback がセッションを確立してマイページへ。
      emailRedirectTo: `${origin}/auth/callback?next=/mypage`,
      // CAPTCHA（Supabase Auth で Turnstile 等を有効化したときのみ検証される）。
      // 未設定なら undefined で、Supabase 側が無効なら影響なし。
      captchaToken: captchaToken || undefined,
      data: {
        name: (profile.name ?? "").trim() || null,
        company: (profile.company ?? "").trim() || null,
        contact: (profile.contact ?? "").trim() || null,
        contact_method: (profile.contactMethod ?? "").trim() || null,
      },
    },
  });

  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    const code = (error as { code?: string }).code ?? "";
    if (code === "user_already_exists" || code === "email_exists" || msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { status: "error", error: "exists" };
    }
    if (msg.includes("captcha")) {
      return { status: "error", error: "captcha" };
    }
    console.error("[signup] signUp failed:", error);
    return { status: "error", error: "failed" };
  }

  // Confirm email OFF: session が返る → そのままログイン済み。
  // Confirm email ON : session は null → 確認メール送信済み。
  if (data.session) return { status: "signedIn" };
  return { status: "confirm" };
}
