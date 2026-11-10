import Link from "next/link";
import { redirect } from "next/navigation";
import ForgotForm from "./ForgotForm";
import Wordmark from "../Wordmark";
import LangToggle from "../LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("パスワードの再設定", "Reset password");
}

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  // ログイン中ならメールを経由せず、そのまま変更画面へ。
  const user = await getCurrentUser();
  if (user) redirect("/account/password");
  const { expired } = await searchParams;
  const lang = await getLang();
  const t = tr(lang);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-6 flex justify-end">
        <LangToggle lang={lang} />
      </div>
      <header className="mb-8">
        <Wordmark align="left" />
        <h1 className="mt-5 text-2xl font-semibold">{t("fp_title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("fp_sub")}</p>
      </header>

      {expired && (
        <p className="mb-6 rounded-lg border border-amber-700/60 bg-amber-950/30 p-3 text-sm leading-relaxed text-amber-200">
          {t("fp_expired")}
        </p>
      )}

      <ForgotForm lang={lang} />

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/login" className="text-accent">
          {t("fp_back_login")}
        </Link>
      </p>
    </main>
  );
}
