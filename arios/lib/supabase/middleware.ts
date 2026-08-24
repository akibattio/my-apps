// Middleware 用: リクエストごとに Supabase セッション(Cookie)を更新する。
// @supabase/ssr の標準パターン。
// ただし Supabase が遅い/不通でもサイト全体が 504 にならないよう、
// タイムアウト保護 + try/catch でフェイルセーフにする。
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }
            response = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      }
    );

    // getUser() を呼ぶことでトークンが更新され、Cookie に反映される。
    // Supabase が遅いときにミドルウェアがタイムアウト(504)しないよう上限を設ける。
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // セッション更新に失敗してもページ自体は返す（サイトを落とさない）。
  }

  return response;
}
