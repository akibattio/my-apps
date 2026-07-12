import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, ensureOwner, isAdminEmail } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイページ — ARIOS" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const admin = createAdminClient();
  const [{ data: ownerRow }, { count: vehicleCount }] = await Promise.all([
    admin.from("owners").select("name").eq("id", owner.ownerId).maybeSingle(),
    admin
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("current_owner_id", owner.ownerId),
  ]);

  const isAdmin = isAdminEmail(user.email);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">マイページ</h1>
        <form action={signOut}>
          <button type="submit" className="text-xs text-muted">
            ログアウト
          </button>
        </form>
      </header>

      <section className="mb-8 rounded-xl border border-neutral-800 p-5">
        <p className="text-xs tracking-widest text-muted">ACCOUNT</p>
        <p className="mt-2 text-sm text-muted">メールアドレス</p>
        <p className="text-foreground">{user.email}</p>
        <p className="mt-3 text-sm text-muted">登録した車</p>
        <p className="text-foreground">{vehicleCount ?? 0} 台</p>
      </section>

      <section className="mb-8">
        <AccountForm initialName={ownerRow?.name ?? ""} />
      </section>

      <nav className="space-y-3">
        <Link
          href="/garage"
          className="block rounded-full bg-accent px-6 py-4 text-center font-medium text-black"
        >
          マイガレージ
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="block rounded-full border border-accent px-6 py-4 text-center font-medium text-accent"
          >
            管理者ダッシュボード
          </Link>
        )}
        <Link
          href="/"
          className="block text-center text-sm text-muted underline-offset-4 hover:underline"
        >
          トップへ
        </Link>
      </nav>
    </main>
  );
}
