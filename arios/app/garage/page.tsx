import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureOwner } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイガレージ — ARIOS" };

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
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold">マイガレージ</h1>
        <form action={signOut}>
          <button type="submit" className="text-xs text-muted">
            ログアウト
          </button>
        </form>
      </header>

      {list.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted">
          まだ車がありません。
          <br />
          下のボタンから最初の1台を登録しましょう。
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((v) => {
            const name =
              [v.manufacturer, v.model].filter(Boolean).join(" ") || "名称未設定の車両";
            const thumb = thumbs.get(v.id);
            return (
              <li key={v.id}>
                <Link
                  href={`/garage/${v.id}`}
                  className="flex items-center gap-4 rounded-xl border border-neutral-800 p-3"
                >
                  <span className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-lg bg-neutral-800 text-neutral-500">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      "車"
                    )}
                  </span>
                  <span>
                    <span className="block font-medium">{name}</span>
                    {v.year && (
                      <span className="block text-sm text-muted">{v.year}</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/register"
        className="mt-8 block rounded-full bg-accent px-6 py-4 text-center font-medium text-black"
      >
        ＋ 車を登録
      </Link>
    </main>
  );
}
