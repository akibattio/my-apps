// 認証まわりのサーバー側ヘルパー。
import { redirect } from "next/navigation";
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
// 管理者は Supabase の認証のユーザー ID（環境変数 ADMIN_USER_IDS、カンマ区切り）で判定する。
// メールアドレスは判定に使わない（同じアドレスで別のアカウントを作られても管理者にならない）。
// ADMIN_USER_IDS が未設定なら管理者なし（誰も管理画面に入れない）。既定値は置かない。
function listFromEnv(name: string, lower = false): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => (lower ? s.trim().toLowerCase() : s.trim()))
    .filter(Boolean);
}

export function getAdminUserIds(): string[] {
  return listFromEnv("ADMIN_USER_IDS");
}

// 管理者のメールアドレス（会員登録で同じアドレスを使わせないためだけに使う。判定には使わない）。
export function getAdminEmails(): string[] {
  return listFromEnv("ADMIN_EMAILS", true);
}

export function isAdminUser(user?: { id: string } | null): boolean {
  if (!user) return false;
  return getAdminUserIds().includes(user.id);
}

// ログイン中かつ管理者なら user を返す。そうでなければ null。
export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminUser(user)) return null;
  return user;
}

// 管理画面のページの最初で呼ぶ。管理者でなければ管理者ログインへ転送する。
export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin-login");
  return admin;
}

// 管理者の確認が済んでから、強い鍵（service_role）のクライアントを返す。
// 管理画面のページとアクションはこれを使う（確認を忘れて強い鍵を使うことがないように）。
export async function adminDb() {
  const admin = await requireAdmin();
  return { admin, db: createAdminClient() };
}
