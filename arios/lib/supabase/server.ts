// サーバー（Server Component / Route Handler / Server Action）用の Supabase クライアント。
// anon キー + Cookie でユーザーセッションを引き継ぐ。RLS が適用される。
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component からの set は Middleware がセッション更新を担うため無視してよい。
          }
        },
      },
    }
  );
}
