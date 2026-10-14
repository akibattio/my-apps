import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import Wordmark from "../Wordmark";
import LangToggle from "../LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "ログイン — LIFE LINE GARAGE" };

export default async function LoginPage() {
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
        <h1 className="mt-5 text-2xl font-semibold">{t("login_title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("login_sub")}</p>
      </header>

      <Suspense fallback={<p className="text-sm text-muted">…</p>}>
        <LoginForm lang={lang} />
      </Suspense>

      <p className="mt-10 text-center text-xs text-muted">
        <Link href="/" className="text-accent">
          {t("backTop")}
        </Link>
      </p>
    </main>
  );
}
