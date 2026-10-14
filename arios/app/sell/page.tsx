import { redirect } from "next/navigation";
import Wordmark from "../Wordmark";
import LangToggle from "../LangToggle";
import SellForm from "../listings/SellForm";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "車を売りたい — LIFE LINE GARAGE",
  description: "お車の情報をご登録ください。ARIOSが買い手をお探しします。",
};

export default async function SellPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/sell");
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
      <div className="mb-4 flex justify-end">
        <LangToggle lang={lang} />
      </div>
      <header className="mb-8 flex flex-col items-center text-center">
        <Wordmark />
        <h1 className="mt-5 text-2xl font-semibold">{t("sell_h1")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("sell_lead")}</p>
      </header>
      <SellForm
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
