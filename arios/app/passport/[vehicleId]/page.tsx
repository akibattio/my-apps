import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

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
    .select("id, manufacturer, model, year, status")
    .eq("id", vehicleId)
    .maybeSingle();

  if (error || !vehicle) notFound();

  const [{ data: histories }, { data: images }] = await Promise.all([
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
  ]);

  const title =
    [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") ||
    "名称未設定の車両";
  const photos = images ?? [];
  const timeline = histories ?? [];

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent">VEHICLE PASSPORT</p>
        <h1 className="mt-3 text-2xl font-semibold">
          {title}
          {vehicle.year ? <span className="text-muted"> · {vehicle.year}</span> : null}
        </h1>
        <span className="mt-3 inline-block rounded-full border border-neutral-700 px-3 py-1 text-xs text-muted">
          {photos.length > 0 ? "写真で確認済み" : "登録済み"}
        </span>
      </header>

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
