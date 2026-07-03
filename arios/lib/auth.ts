// 認証まわりのサーバー側ヘルパー。
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ログインユーザーに対応する Owner を用意する（無ければ作る）。1ユーザー1Owner。
// Owner 作成は service_role で行う（RLS の insert は本人条件を満たすが、初回は
// まだ Owner が無い状態なのでサーバー側で確実に作る）。
export async function ensureOwner(): Promise<
  { userId: string; ownerId: string; email: string | null } | null
> {
  const user = await getCurrentUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("owners")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { userId: user.id, ownerId: existing.id as string, email: user.email ?? null };
  }

  const { data: created, error } = await admin
    .from("owners")
    .insert({
      auth_user_id: user.id,
      name: user.email ?? "オーナー",
      email: user.email ?? null,
      owner_type: "PRIVATE_OWNER",
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return { userId: user.id, ownerId: created.id as string, email: user.email ?? null };
}
