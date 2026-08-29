import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// 合言葉ゲートは撤去（一般の入口は公開フォーム /sell・/buy）。
// AIなど社内機能はページ側でログイン必須にして保護する。
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // 静的アセットと health は除外
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
