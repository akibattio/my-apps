import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOwner, isAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイガレージ — ARIOS GARAGE" };

export default async function GaragePage() {
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  // RLS により、自分が所有する車だけが返る
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model, year")
    .order("created_at", { ascending: false });

  const list = vehicles ?? [];
  const ids = list.map((v) => v.id);
  const thumbs = new Map<string, string>();
  if (ids.length > 0) {
    const { data: imgs } = await supabase
      .from("images")
      .select("vehicle_id, image_url, created_at")
      .in("vehicle_id", ids)
      .order("created_at", { ascending: true });
    for (const img of imgs ?? []) {
      if (!thumbs.has(img.vehicle_id)) thumbs.set(img.vehicle_id, img.image_url);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent">MY GARAGE</p>
          <h1 className="mt-1 text-2xl font-semibold">マイガレージ</h1>
        </div>
        {isAdminEmail(owner.email) && (
          <Link href="/admin" className="text-sm text-accent">
            管理者 ›
          </Link>
        )}
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border text-2xl text-muted">
            ✧
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            まだ車がありません。
            <br />
            下のボタンから最初の1台を登録しましょう。
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 font-semibold text-black"
          >
            愛車を登録する
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {list.map((v) => {
              const name =
                [v.manufacturer, v.model].filter(Boolean).join(" ") || "名称未設定の車両";
              const thumb = thumbs.get(v.id);
              return (
                <li key={v.id}>
                  <Link
                    href={`/garage/${v.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 active:border-accent/40"
                  >
                    <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl bg-neutral-800 text-neutral-500">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "車"
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      {v.year && (
                        <span className="block text-sm text-muted">{v.year}</span>
                      )}
                    </span>
                    <span className="flex-none text-muted">›</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/register"
            className="mt-8 block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black shadow-lg shadow-accent/10"
          >
            ＋ 車を登録
          </Link>
        </>
      )}
    </main>
  );
}
