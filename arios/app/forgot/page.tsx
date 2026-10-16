import Link from "next/link";
import { redirect } from "next/navigation";
import ForgotForm from "./ForgotForm";
import Wordmark from "../Wordmark";
import LangToggle from "../LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "パスワードの再設定 — LIFE LINE GARAGE" };

export default async function ForgotPage() {
  const user = await getCurrentUser();
  if (user) redirect("/mypage");
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

      <ForgotForm lang={lang} />

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/login" className="text-accent">
          {t("fp_back_login")}
        </Link>
      </p>
    </main>
  );
}
