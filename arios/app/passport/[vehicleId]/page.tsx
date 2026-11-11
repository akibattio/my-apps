import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeTrust } from "@/lib/trust";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";
import { carName, linkLabel } from "@/lib/garage";
import LangToggle from "../../LangToggle";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("ビークル・パスポート", "Vehicle Passport");
}

// Vehicle Passport（公開ページ）。この車の歴史を時間軸で見せる。
// 持ち主が「公開する」を選んだ車だけ表示する。出すのは公開の記録と、その記録の写真だけ。
// 車体番号・持ち主・非公開の記録・書類の中身は出さない。
export default async function PassportPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const lang = await getLang();
  const t = tr(lang);
  const supabase = createAdminClient();

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model, year, vin, is_public")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error || !vehicle || !vehicle.is_public) notFound();

  const [{ data: histories }, { data: images }, { count: documentCount }] = await Promise.all([
    supabase
      .from("histories")
      .select("id, history_type, title, description, event_date, links, source, created_at")
      .eq("vehicle_id", vehicleId)
      .eq("visibility", "PUBLIC")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("images")
      .select("id, image_url, history_id, created_at")
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: true }),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("vehicle_id", vehicleId),
  ]);

  const timeline = histories ?? [];
  // 非公開の記録に付いた写真は出さない
  const publicHistoryIds = new Set(timeline.map((h) => h.id));
  const photos = (images ?? []).filter((img) => !img.history_id || publicHistoryIds.has(img.history_id));

  // 証拠の量の目安（どれも持ち主の登録で、運営の確認ではない）
  const trust = computeTrust(
    {
      photoCount: photos.length,
      documentCount: documentCount ?? 0,
      hasVin: Boolean(vehicle.vin && String(vehicle.vin).trim()),
      historyCount: timeline.length,
    },
    lang
  );
  const typeLabel = (h: { source: string | null; history_type: string }) =>
    h.source === "MEMBER_REGISTRATION" ? t("ht_registered") : t(`ht_${h.history_type}`);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <div className="mb-4 flex justify-end">
        <LangToggle lang={lang} />
      </div>
      <header className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent">VEHICLE PASSPORT</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {carName(vehicle, t("garage_unnamed"))}
          {vehicle.year ? <span className="text-muted"> · {vehicle.year}</span> : null}
        </h1>
      </header>

      <section className="mb-8 rounded-xl border border-neutral-800 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs tracking-widest text-muted">TRUST</p>
            <p className="mt-1 text-lg font-medium text-accent">
              {trust.levelLabel}
              <span className="ml-2 text-xs text-muted">LEVEL {trust.levelIndex}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-semibold">{trust.score}</span>
            <span className="text-sm text-muted"> / 100</span>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full bg-accent" style={{ width: `${trust.score}%` }} />
        </div>
        <ul className="mt-4 space-y-1.5">
          {trust.reasons.map((r) => (
            <li
              key={r.label}
              className={"flex items-center gap-2 text-sm " + (r.met ? "text-foreground" : "text-neutral-600")}
            >
              <span className={r.met ? "text-accent" : "text-neutral-700"}>{r.met ? "✓" : "○"}</span>
              {r.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">{t("pp_trust_note")}</p>
      </section>

      {photos.length > 0 && (
        <section className="mb-8 grid grid-cols-3 gap-2">
          {photos.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.image_url} alt="" className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm tracking-widest text-muted">{t("pp_records")}</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted">{t("pp_empty")}</p>
        ) : (
          <ol className="space-y-6 border-l border-neutral-700 pl-6">
            {timeline.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  {h.event_date && <span className="tabular-nums text-accent">{h.event_date.replaceAll("-", ".")}</span>}
                  <span className="rounded-full border border-border px-2 text-[11px] text-muted">{typeLabel(h)}</span>
                </div>
                {h.title && <div className="mt-1 font-medium">{h.title}</div>}
                {h.description && (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{h.description}</p>
                )}
                {(h.links ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(h.links as string[]).map((u) => (
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
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="mt-12 text-center text-xs text-muted">
        <p>{t("pp_footer")}</p>
        <Link href="/" className="mt-2 inline-block text-accent">
          LIFE LINE GARAGE
        </Link>
      </footer>
    </main>
  );
}
