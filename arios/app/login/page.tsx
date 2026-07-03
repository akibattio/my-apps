import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "ログイン — ARIOS" };

export default async function LoginPage() {
  // 既にログイン済みならガレージへ
  const user = await getCurrentUser();
  if (user) redirect("/garage");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-8">
        <p className="text-xs tracking-[0.3em] text-accent">ARIOS</p>
        <h1 className="mt-4 text-2xl font-semibold">
          ログインして
          <br />
          ガレージを開く
        </h1>
      </header>

      <LoginForm />

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/" className="text-accent">
          トップへ戻る
        </Link>
      </p>
    </main>
  );
}
