import { NextResponse } from "next/server";
import { safeNext } from "@/lib/nav";

// 合言葉の検証。正しければ Cookie を発行して next へ、違えば /gate に戻す。
export async function POST(request: Request) {
  const form = await request.formData();
  const code = String(form.get("code") ?? "");
  // オープンリダイレクト対策: 自サイト内パスのみ許可（バックスラッシュ等も拒否）
  const next = safeNext(String(form.get("next") ?? "/"), "/");

  const passcode = process.env.SITE_PASSCODE;
  const origin = new URL(request.url).origin;

  if (passcode && code === passcode) {
    const res = NextResponse.redirect(new URL(next, origin), { status: 303 });
    res.cookies.set("arios_gate", passcode, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30日
    });
    return res;
  }

  const back = new URL("/gate", origin);
  back.searchParams.set("error", "1");
  back.searchParams.set("next", next);
  return NextResponse.redirect(back, { status: 303 });
}
