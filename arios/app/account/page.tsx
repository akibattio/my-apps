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
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent">ACCOUNT</p>
          <h1 className="mt-1 text-2xl font-semibold">マイページ</h1>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-full border border-border px-4 py-2 text-xs text-muted"
          >
            ログアウト
          </button>
        </form>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted">メールアドレス</p>
          <p className="mt-1 break-all text-foreground">{user.email}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted">登録した車</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {vehicleCount ?? 0}
            <span className="ml-1 text-sm font-normal text-muted">台</span>
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted">権限</p>
          <p className="mt-1 text-lg font-medium text-foreground">
            {isAdmin ? "管理者" : "オーナー"}
          </p>
        </div>
      </section>

      <section className="mb-8">
        <AccountForm initialName={ownerRow?.name ?? ""} />
      </section>

      {isAdmin && (
        <nav>
          <Link
            href="/admin"
            className="block rounded-full border border-accent px-6 py-4 text-center font-medium text-accent"
          >
            管理者ダッシュボード ›
          </Link>
        </nav>
      )}
    </main>
  );
}
