import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GarageVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // RLS により、自分が所有する車でなければ返らない
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model, year")
    .eq("id", id)
    .maybeSingle();

  if (!vehicle) notFound();

  const [{ data: histories }, { data: images }, { count: documentCount }] =
    await Promise.all([
      supabase
        .from("histories")
        .select("id, title, description, event_date, created_at")
        .eq("vehicle_id", id)
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("images")
        .select("id, image_url, created_at")
        .eq("vehicle_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("vehicle_id", id),
    ]);

  const name =
    [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") ||
    "名称未設定の車両";
  const photos = images ?? [];
  const timeline = histories ?? [];

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/garage" className="text-muted" aria-label="ガレージに戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">
          {name}
          {vehicle.year ? <span className="text-muted"> · {vehicle.year}</span> : null}
        </h1>
      </header>

      {photos.length > 0 && (
        <section className="mb-8 grid grid-cols-3 gap-2">
          {photos.slice(0, 6).map((img) => (
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
                <p className="mt-1 text-sm leading-relaxed text-muted">{h.description}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <Link
        href={`/garage/${id}/add-history`}
        className="mt-10 block rounded-full bg-accent px-6 py-4 text-center font-medium text-black"
      >
        ＋ 出来事を追加
      </Link>

      <Link
        href={`/garage/${id}/add-document`}
        className="mt-3 block rounded-full border border-neutral-700 px-6 py-4 text-center font-medium text-muted"
      >
        ＋ 書類を追加
        {documentCount ? `（現在 ${documentCount} 件）` : "（車検証・整備記録など）"}
      </Link>

      <p className="mt-6 text-center text-xs text-muted">
        <Link href={`/passport/${id}`} className="text-accent">
          公開ページ（パスポート）を見る
        </Link>
      </p>
    </main>
  );
}
