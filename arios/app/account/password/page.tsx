import Link from "next/link";
import { redirect } from "next/navigation";
import NewPasswordForm from "./NewPasswordForm";
import Wordmark from "../../Wordmark";
import LangToggle from "../../LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "新しいパスワードの設定 — LIFE LINE GARAGE" };

// 再設定メールのリンク → /auth/callback でセッション確立 → この画面で新パスワードを設定。
export default async function NewPasswordPage() {
  // セッションが無い（リンク切れ等）場合は再送画面へ。
  const user = await getCurrentUser();
  if (!user) redirect("/forgot");
  const lang = await getLang();
  const t = tr(lang);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 flex justify-end">
        <LangToggle lang={lang} />
      </div>
      <header className="mb-8">
        <Wordmark align="left" />
        <h1 className="mt-5 text-2xl font-semibold">{t("np_title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("np_sub")}</p>
      </header>

      <NewPasswordForm lang={lang} />

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/mypage" className="text-accent">
          {t("np_to_mypage")}
        </Link>
      </p>
    </main>
  );
}
