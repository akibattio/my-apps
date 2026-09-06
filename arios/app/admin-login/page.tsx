import Link from "next/link";
import { redirect } from "next/navigation";
import AdminLoginForm from "./AdminLoginForm";
import { getCurrentUser, getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理者ログイン — LIFE LINE GARAGE" };

export default async function AdminLoginPage() {
  // すでに管理者ならそのまま管理画面へ
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");
  // 管理者でないアカウントでログイン中の場合の注意表示
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-8">
        <p className="text-xs tracking-[0.35em] text-accent">ARIOS ADMIN</p>
        <h1 className="mt-2 text-2xl font-semibold">管理者ログイン</h1>
        <p className="mt-2 text-sm text-muted">
          ARIOS運用担当者（管理者）専用のログインです。
        </p>
      </header>

      {user && (
        <p className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted">
          現在「{user.email}」でログイン中ですが、このアカウントには管理者権限がありません。
          管理者のメールアドレスでログインし直してください。
        </p>
      )}

      <AdminLoginForm />

      <p className="mt-10 text-center text-xs text-muted">
        お客様の方は{" "}
        <Link href="/login" className="text-accent">
          こちらからログイン
        </Link>
      </p>
    </main>
  );
}
