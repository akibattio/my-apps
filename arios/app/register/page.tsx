import Link from "next/link";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "愛車を登録 — ARIOS" };

// Register（公開・ログイン不要）。写真 → 最小限の手入力 → 登録。
export default function RegisterPage() {
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
