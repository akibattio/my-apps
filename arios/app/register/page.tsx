import Link from "next/link";
import { redirect } from "next/navigation";
import RegisterForm from "./RegisterForm";
import LangToggle from "../LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("愛車を登録", "Register your car");
}

// マイガレージへの車の登録（売らない車も）。会員のみ。
export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/register");
  const lang = await getLang();
  const t = tr(lang);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/garage" className="text-sm text-accent hover:underline">
          ‹ {t("gd_back")}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <h1 className="text-2xl font-semibold">{t("reg_title")}</h1>
      <p className="mt-2 mb-8 text-sm leading-relaxed text-muted">{t("reg_lead")}</p>

      <RegisterForm lang={lang} />
    </main>
  );
}
