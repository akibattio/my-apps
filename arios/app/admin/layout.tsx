import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理者 — ARIOS" };

// 管理者エリアのゲート。管理者(メール許可リスト)以外はトップへ。
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
        <p className="text-sm tracking-[0.3em] text-accent">ARIOS ADMIN</p>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/admin" className="hover:text-foreground">
            サマリー
          </Link>
          <Link href="/admin/vehicles" className="hover:text-foreground">
            車両
          </Link>
          <Link href="/admin/owners" className="hover:text-foreground">
            オーナー
          </Link>
          <Link href="/account" className="hover:text-foreground">
            マイページ
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
