import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeTrust } from "@/lib/trust";

export const dynamic = "force-dynamic";

// Vehicle Passport（公開 Timeline）。この車の人生を時間軸で見せる。
// Step 1 では読み取り専用でサーバー側に描画する。RLS対応の公開ポリシーは後で入れる。
export default async function PassportPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const supabase = createAdminClient();

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model, year, status, vin")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error || !vehicle) notFound();

  const [{ data: histories }, { data: images }, { count: documentCount }] =
    await Promise.all([
      supabase
        .from("histories")
        .select("id, history_type, title, description, event_date, created_at")
        .eq("vehicle_id", vehicleId)
        .eq("visibility", "PUBLIC")
        .order("event_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("images")
        .select("id, image_url, created_at")
        .eq("vehicle_id", vehicleId)
        .order("created_at", { ascending: true }),
      supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("vehicle_id", vehicleId),
    ]);

  const title =
    [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") ||
    "名称未設定の車両";
  const photos = images ?? [];
  const timeline = histories ?? [];

  // 証拠ベースの信頼度を算出（写真・書類・VIN・履歴の充実）
  const trust = computeTrust({
    photoCount: photos.length,
    documentCount: documentCount ?? 0,
    hasVin: Boolean(vehicle.vin && String(vehicle.vin).trim()),
    historyCount: timeline.length,
  });

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent">VEHICLE PASSPORT</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {title}
          {vehicle.year ? <span className="text-muted"> · {vehicle.year}</span> : null}
        </h1>
      </header>

      {/* 信頼度（証拠ベース）*/}
      <section className="mb-8 rounded-xl border border-neutral-800 p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs tracking-widest text-muted">TRUST</p>
            <p className="mt-1 text-lg font-medium text-accent">
              {trust.levelLabel}
              <span className="ml-2 text-xs text-muted">
                LEVEL {trust.levelIndex}
              </span>
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
              className={
                "flex items-center gap-2 text-sm " +
                (r.met ? "text-foreground" : "text-neutral-600")
              }
            >
              <span className={r.met ? "text-accent" : "text-neutral-700"}>
                {r.met ? "✓" : "○"}
              </span>
              {r.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          信頼度は証拠が増えるほど上がります。写真・書類・車台番号・履歴の積み重ねが根拠です。
        </p>
      </section>

      {photos.length > 0 && (
        <section className="mb-8 grid grid-cols-3 gap-2">
          {photos.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.image_url}
              alt=""
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm tracking-widest text-muted">TIMELINE</h2>
        <ol className="space-y-6 border-l border-neutral-700 pl-6">
          {timeline.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
              {h.event_date && (
                <div className="text-sm text-accent">
                  {h.event_date.replaceAll("-", ".")}
                </div>
              )}
              <div className="mt-1 font-medium">{h.title ?? "記録"}</div>
              {h.description && (
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {h.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-12 text-center text-xs text-muted">
        <p>History is never deleted.</p>
        <Link href="/" className="mt-2 inline-block text-accent">
          ARIOS トップ
        </Link>
      </footer>
    </main>
  );
}
