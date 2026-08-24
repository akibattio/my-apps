import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const GATE_COOKIE = "arios_gate";

// ゲートを通す（合言葉不要の）パス
function gateAllowed(pathname: string) {
  return (
    pathname.startsWith("/gate") ||
    pathname.startsWith("/api/gate") ||
    pathname === "/manifest.webmanifest"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 合言葉ゲート（SITE_PASSCODE を設定したときだけ有効）。
  const passcode = process.env.SITE_PASSCODE;
  if (passcode && !gateAllowed(pathname)) {
    const ok = request.cookies.get(GATE_COOKIE)?.value === passcode;
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/gate";
      url.search = "";
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
  }

  // ゲート画面・ゲートAPI・manifest はセッション更新不要 → Supabase に触れず即返す。
  // （Supabase が遅くてもゲート画面は必ず表示できるようにする）
  if (gateAllowed(pathname)) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  // 静的アセットと health は除外
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
