import { redirect } from "next/navigation";
import Wordmark from "../Wordmark";
import BuyForm from "../listings/BuyForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "車を買いたい — LIFE LINE GARAGE",
  description: "お探しの車をご登録ください。ARIOSが売り手をお探しします。",
};

export default async function BuyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/buy");
  const m = (user.user_metadata ?? {}) as {
    name?: string;
    company?: string;
    contact?: string;
    contact_method?: string;
  };
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <Wordmark />
        <h1 className="mt-5 text-2xl font-semibold">車を買いたい方へ</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          お探しの車を1台ずつご登録ください。ARIOSが売り手をお探しします。
        </p>
      </header>
      <BuyForm
        defaultEmail={user?.email ?? undefined}
        defaultName={m.name ?? undefined}
        defaultCompany={m.company ?? undefined}
        defaultContact={m.contact ?? undefined}
        defaultContactMethod={m.contact_method ?? undefined}
      />
    </main>
  );
}
