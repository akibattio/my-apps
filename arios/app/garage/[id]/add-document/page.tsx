import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import AddDocumentForm from "./AddDocumentForm";
import { pageTitle } from "@/lib/meta";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";
import { carName } from "@/lib/garage";
import LangToggle from "../../../LangToggle";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("書類を追加", "Add a document");
}

export default async function AddDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/garage/${id}/add-document`);
  const lang = await getLang();
  const t = tr(lang);

  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) notFound();

  const name = carName(vehicle, t("garage_unnamed"));

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/garage/${id}`} className="text-sm text-accent hover:underline">
          ‹ {name}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <h1 className="text-2xl font-semibold">{t("ad_title")}</h1>
      <p className="mt-2 mb-8 text-sm text-muted">{fill(t("ad_lead"), { name })}</p>

      <AddDocumentForm vehicleId={id} lang={lang} />
    </main>
  );
}
