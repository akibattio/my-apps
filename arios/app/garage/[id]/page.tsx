import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";
import { throwIfDbError } from "@/lib/db";
import { carName, linkLabel, todayIso } from "@/lib/garage";
import LangToggle from "../../LangToggle";
import { setVehiclePublic, setHistoryVisibility } from "./actions";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("愛車の記録", "Car records");
}

type History = {
  id: string;
  history_type: string;
  title: string | null;
  description: string | null;
  event_date: string | null;
  next_due_date: string | null;
  mileage: number | null;
  links: string[] | null;
  source: string | null;
  visibility: string;
  created_at: string;
};

export default async function GarageVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/garage/${id}`);
  const lang = await getLang();
  const t = tr(lang);

  // RLS により、自分が持ち主の車でなければ返らない（運営だけの記録も返らない）
  const supabase = await createClient();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id, vin, manufacturer, model, year, is_public")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error, "garage/[id]");
  if (!vehicle) notFound();

  const [{ data: histories, error: hErr }, { data: images }, { data: docs }] = await Promise.all([
    supabase
      .from("histories")
      .select("id, history_type, title, description, event_date, next_due_date, mileage, links, source, visibility, created_at")
      .eq("vehicle_id", id)
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("images")
      .select("id, image_url, history_id, created_at")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("documents").select("history_id, document_type").eq("vehicle_id", id),
  ]);
  throwIfDbError(hErr, "garage/[id]");

  const timeline = (histories ?? []) as History[];
  const photos = images ?? [];
  const photosByHistory = new Map<string, string[]>();
  for (const img of photos) {
    if (!img.history_id) continue;
    photosByHistory.set(img.history_id, [...(photosByHistory.get(img.history_id) ?? []), img.image_url]);
  }
  const documentCount = (docs ?? []).length;
  const docType = new Map<string, string>();
  for (const d of docs ?? []) if (d.history_id && d.document_type) docType.set(d.history_id, d.document_type);
  const today = todayIso();
  const typeLabel = (h: History) =>
    h.source === "MEMBER_REGISTRATION"
      ? t("ht_registered")
      : h.history_type === "DOCUMENT" && docType.has(h.id)
        ? t(`dt_${docType.get(h.id)}`)
        : t(`ht_${h.history_type}`);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/garage" className="text-sm text-accent hover:underline">
          ‹ {t("gd_back")}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {carName(vehicle, t("garage_unnamed"))}
            {vehicle.year ? <span className="text-muted"> · {vehicle.year}</span> : null}
          </h1>
          {vehicle.vin && (
            <p className="mt-1 text-xs text-muted">
              {t("gd_vin")}: <span className="font-mono">{vehicle.vin}</span>
            </p>
          )}
        </div>
        <Link href={`/garage/${id}/edit`} className="flex-none text-sm text-accent">
          {t("gd_edit")}
        </Link>
      </header>

      {photos.length > 0 && (
        <section className="mb-8 grid grid-cols-3 gap-2">
          {photos.slice(0, 6).map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.image_url} alt="" className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </section>
      )}

      <Link
        href={`/garage/${id}/add-history`}
        className="block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black"
      >
        {t("gd_add_history")}
      </Link>

      <section className="mt-8">
        <h2 className="mb-4 text-sm tracking-widest text-muted">{t("gd_records")}</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted">{t("gd_empty")}</p>
        ) : (
          <ol className="space-y-7 border-l border-neutral-700 pl-6">
            {timeline.map((h) => {
              const pics = photosByHistory.get(h.id) ?? [];
              const isPublic = h.visibility === "PUBLIC";
              return (
                <li key={h.id} id={`h-${h.id}`} className="relative">
                  <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                  <div className="flex flex-wrap items-baseline gap-2 text-sm">
                    {h.event_date && <span className="tabular-nums text-accent">{h.event_date.replaceAll("-", ".")}</span>}
                    <span className="rounded-full border border-border px-2 text-[11px] text-muted">{typeLabel(h)}</span>
                    <span className={`text-[11px] ${isPublic ? "text-emerald-400" : "text-neutral-500"}`}>
                      {isPublic ? t("gd_rec_public") : t("gd_rec_private")}
                    </span>
                  </div>
                  {h.title && <div className="mt-1 font-medium">{h.title}</div>}
                  {h.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{h.description}</p>
                  )}
                  {(h.mileage != null || h.next_due_date) && (
                    <p className="mt-1 text-xs text-muted">
                      {h.mileage != null && <>{t("gd_mileage")}: {h.mileage.toLocaleString()} km　</>}
                      {h.next_due_date && (
                        <span className={h.next_due_date < today ? "text-red-400" : "text-accent"}>
                          {t("gd_next_due")}: {h.next_due_date.replaceAll("-", ".")}
                        </span>
                      )}
                    </p>
                  )}
                  {(h.links ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(h.links ?? []).map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="rounded-full border border-border px-3 py-1 text-xs text-accent hover:border-accent"
                        >
                          {linkLabel(u)} ↗
                        </a>
                      ))}
                    </div>
                  )}
                  {pics.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {pics.map((u) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={u} src={u} alt="" className="aspect-square w-full rounded-md object-cover" />
                      ))}
                    </div>
                  )}
                  <form action={setHistoryVisibility} className="mt-2">
                    <input type="hidden" name="historyId" value={h.id} />
                    <input type="hidden" name="public" value={isPublic ? "0" : "1"} />
                    <button className="text-[11px] text-muted underline-offset-2 hover:text-accent hover:underline">
                      {isPublic ? t("gd_rec_to_private") : t("gd_rec_to_public")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <Link
        href={`/garage/${id}/add-document`}
        className="mt-10 block rounded-full border border-neutral-700 px-6 py-4 text-center text-sm text-muted hover:border-accent"
      >
        {t("gd_add_doc")}
        {documentCount ? fill(t("gd_doc_count"), { n: documentCount }) : t("gd_doc_hint")}
      </Link>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-medium">{t("gd_public_title")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {vehicle.is_public ? t("gd_public_on") : t("gd_public_off")}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <form action={setVehiclePublic}>
            <input type="hidden" name="vehicleId" value={id} />
            <input type="hidden" name="public" value={vehicle.is_public ? "0" : "1"} />
            <button className="rounded-full border border-border px-4 py-2 text-xs hover:border-accent hover:text-accent">
              {vehicle.is_public ? t("gd_make_private") : t("gd_make_public")}
            </button>
          </form>
          {vehicle.is_public && (
            <Link href={`/passport/${id}`} className="text-xs text-accent">
              {t("gd_view_public")}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
