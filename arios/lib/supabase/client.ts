// ブラウザ（Client Component）用の Supabase クライアント。
// anon キーのみ使用。RLS が全アクセスを制御する。
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
