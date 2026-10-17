import Link from "next/link";
import { redirect } from "next/navigation";
import Wordmark from "../Wordmark";
import LangToggle from "../LangToggle";
import BuyForm from "../listings/BuyForm";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "車を買いたい — LIFE LINE GARAGE",
  description: "お探しの車をご登録ください。ARIOSが売り手をお探しします。",
};

export default async function BuyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/buy");
  const lang = await getLang();
  const t = tr(lang);
  const m = (user.user_metadata ?? {}) as {
    name?: string;
    company?: string;
    contact?: string;
    contact_method?: string;
  };
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-accent hover:underline">
          ‹ {t("backTop")}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <header className="mb-8 flex flex-col items-center text-center">
        <Wordmark />
        <h1 className="mt-5 text-2xl font-semibold">{t("buy_h1")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("buy_lead")}</p>
      </header>
      <BuyForm
        lang={lang}
        defaultEmail={user?.email ?? undefined}
        defaultName={m.name ?? undefined}
        defaultCompany={m.company ?? undefined}
        defaultContact={m.contact ?? undefined}
        defaultContactMethod={m.contact_method ?? undefined}
      />
    </main>
  );
}
