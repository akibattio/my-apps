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
  const ownerId = await ownerIdForUser(user.id, user.email ?? null);
  if (!ownerId) return null;
  return { userId: user.id, ownerId, email: user.email ?? null };
}

// ユーザーIDから Owner を引く（無ければ作る）。ログイン中の本人以外（売りたい登録の登録者など）にも使う。
export async function ownerIdForUser(userId: string, email: string | null): Promise<string | null> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("owners")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await admin
    .from("owners")
    .insert({
      auth_user_id: userId,
      name: email ?? "オーナー",
      email,
      owner_type: "PRIVATE_OWNER",
    })
    .select("id")
    .single();
  if (!error && created) return created.id as string;

  // 同時に作られた場合（一意制約）はもう一度引く
  const { data: again } = await admin
    .from("owners")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return (again?.id as string | undefined) ?? null;
}

// ---- 管理者判定 ----
// 管理者はメール許可リストで判定する。既定は akiba@sofcom.co.jp。
// 本番では ADMIN_EMAILS（カンマ区切り）で上書きできる。
const DEFAULT_ADMIN_EMAILS = ["akiba@sofcom.co.jp", "arios.suzuki@gmail.com"];

export function getAdminEmails(): string[] {
  const env = process.env.ADMIN_EMAILS;
  if (env && env.trim()) {
    return env
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

// ログイン中かつ管理者なら user を返す。そうでなければ null。
export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
