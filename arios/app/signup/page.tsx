import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SignupForm from "./SignupForm";
import Wordmark from "../Wordmark";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "新規登録 — ARIOS GARAGE" };

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/mypage");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-8">
        <Wordmark align="left" />
        <h1 className="mt-5 text-2xl font-semibold">マイページ登録</h1>
        <p className="mt-2 text-sm text-muted">
          登録すると、売りたい・買いたいの状況をマイページでまとめて確認できます。
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
        <SignupForm />
      </Suspense>

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/" className="text-accent">
          トップへ戻る
        </Link>
      </p>
    </main>
  );
}
