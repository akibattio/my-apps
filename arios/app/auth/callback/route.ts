import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// メールのマジックリンクを踏んだときの入口。token_hash を検証してセッションを確立する。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = searchParams.get("next") ?? "/garage";

  if (token_hash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
