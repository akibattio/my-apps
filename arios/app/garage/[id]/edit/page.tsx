import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import EditVehicleForm from "./EditVehicleForm";
import { pageTitle } from "@/lib/meta";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import LangToggle from "../../../LangToggle";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("登録内容を編集", "Edit car");
}

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/garage/${id}/edit`);
  const lang = await getLang();
  const t = tr(lang);

  // 本人が所有する車か（RLS）
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, vin, manufacturer, model, year")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href={`/garage/${id}`} className="text-sm text-accent hover:underline">
          ‹ {t("gd_back")}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <h1 className="mb-6 text-2xl font-semibold">{t("ev_title")}</h1>
      {vehicle.vin && (
        <p className="mb-5 rounded-xl border border-border bg-card p-3 text-xs text-muted">
          {t("gd_vin")}: <span className="font-mono text-foreground">{vehicle.vin}</span>
          <span className="mt-1 block">{t("ev_vin_note")}</span>
        </p>
      )}

      <EditVehicleForm
        lang={lang}
        vehicleId={id}
        initial={{
          manufacturer: vehicle.manufacturer ?? "",
          model: vehicle.model ?? "",
          year: vehicle.year ? String(vehicle.year) : "",
        }}
      />
    </main>
  );
}
