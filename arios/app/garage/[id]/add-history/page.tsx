import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";
import { carName, todayIso } from "@/lib/garage";
import LangToggle from "../../../LangToggle";
import AddHistoryForm from "./AddHistoryForm";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("記録を追加", "Add a record");
}

export default async function AddHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/garage/${id}/add-history`);
  const lang = await getLang();
  const t = tr(lang);

  // 本人が持ち主の車か（RLS）
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/garage/${id}`} className="text-sm text-accent hover:underline">
          ‹ {carName(vehicle, t("garage_unnamed"))}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <h1 className="text-2xl font-semibold">{t("ah_title")}</h1>
      <p className="mt-2 mb-8 text-sm text-muted">
        {fill(t("ah_lead"), { name: carName(vehicle, t("garage_unnamed")) })}
      </p>

      <AddHistoryForm vehicleId={id} today={todayIso()} lang={lang} />
    </main>
  );
}
