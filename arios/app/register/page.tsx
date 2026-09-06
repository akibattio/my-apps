import Link from "next/link";
import { redirect } from "next/navigation";
import RegisterForm from "./RegisterForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "愛車を登録 — LIFE LINE GARAGE" };

// AI下書きを含む写真登録は社内(ログイン)のみ。AIを外部に出さない。
export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Link href="/" className="text-muted" aria-label="トップに戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">愛車を登録</h1>
      </header>

      <RegisterForm />
    </main>
  );
}
