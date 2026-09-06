import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import Wordmark from "../Wordmark";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "ログイン — LIFE LINE GARAGE" };

export default async function LoginPage() {
  // 既にログイン済みならマイページへ
  const user = await getCurrentUser();
  if (user) redirect("/mypage");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-8">
        <Wordmark align="left" />
        <h1 className="mt-5 text-2xl font-semibold">ログイン</h1>
        <p className="mt-2 text-sm text-muted">
          メールアドレスとパスワードでログインします。
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
        <LoginForm />
      </Suspense>

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/" className="text-accent">
          トップへ戻る
        </Link>
      </p>
    </main>
  );
}
