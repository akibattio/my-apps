import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner, isAdminUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";
import { throwIfDbError } from "@/lib/db";
import { nextDueByVehicle, todayIso, carName } from "@/lib/garage";
import LangToggle from "../LangToggle";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("マイガレージ", "My Garage");
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const owner = await ensureOwner();
  if (!owner) redirect("/login?next=/garage");
  const { pending } = await searchParams;
  const lang = await getLang();
  const t = tr(lang);

  // RLS により、自分が持ち主の車だけが返る
  const supabase = await createClient();
  const { data: vehicles, error } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model, year")
    .order("created_at", { ascending: false });
  throwIfDbError(error, "garage");

  const list = vehicles ?? [];
  const ids = list.map((v) => v.id);
  const thumbs = new Map<string, string>();
  let due = new Map<string, string>();
  if (ids.length > 0) {
    const [{ data: imgs }, { data: dueRows }] = await Promise.all([
      supabase
        .from("images")
        .select("vehicle_id, image_url, created_at")
        .in("vehicle_id", ids)
        .order("created_at", { ascending: true }),
      supabase
        .from("histories")
        .select("vehicle_id, next_due_date, event_date, created_at")
        .in("vehicle_id", ids)
        .not("next_due_date", "is", null),
    ]);
    for (const img of imgs ?? []) {
      if (!thumbs.has(img.vehicle_id)) thumbs.set(img.vehicle_id, img.image_url);
    }
    due = nextDueByVehicle(dueRows ?? []);
  }

  // 運営が確認中の車（自分が入れた車体番号だけを見せる。相手の情報は出さない）
  const admin = createAdminClient();
  const { data: claims } = await admin
    .from("vehicle_claims")
    .select("id, vehicle:vehicle_id(vin)")
    .eq("owner_id", owner.ownerId)
    .eq("status", "PENDING");
  const pendingVins = (claims ?? [])
    .map((c) => {
      const v = Array.isArray(c.vehicle) ? c.vehicle[0] : c.vehicle;
      return (v as { vin: string | null } | null)?.vin ?? null;
    })
    .filter((v): v is string => !!v);

  const today = todayIso();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/mypage" className="text-sm text-accent hover:underline">
          ‹ {t("np_to_mypage")}
        </Link>
        <div className="flex items-center gap-4">
          {isAdminUser({ id: owner.userId }) && (
            <Link href="/admin/vehicles" className="text-sm text-accent">
              {t("garage_admin")}
            </Link>
          )}
          <LangToggle lang={lang} />
        </div>
      </div>
      <header className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent">MY GARAGE</p>
        <h1 className="mt-1 text-2xl font-semibold">{t("garage_title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("garage_lead")}</p>
      </header>

      {(pending || pendingVins.length > 0) && (
        <section className="mb-6 rounded-2xl border border-amber-700/60 bg-amber-950/30 p-4 text-sm">
          <p className="font-semibold text-amber-200">{pending ? t("reg_pending_title") : t("garage_pending_title")}</p>
          <p className="mt-1 leading-relaxed text-amber-100/80">
            {pending === "2" ? t("reg_pending_body_unowned") : pending ? t("reg_pending_body") : t("garage_pending_body")}
          </p>
          {pendingVins.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-amber-100/70">
              {pendingVins.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {list.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border text-2xl text-muted">
            ✧
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">{t("garage_empty")}</p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 font-semibold text-black"
          >
            {t("garage_register")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {list.map((v) => {
              const thumb = thumbs.get(v.id);
              const d = due.get(v.id);
              return (
                <li key={v.id}>
                  <Link
                    href={`/garage/${v.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 hover:border-accent/40"
                  >
                    <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl bg-neutral-800 text-neutral-500">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "✧"
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{carName(v, t("garage_unnamed"))}</span>
                      {v.year && <span className="block text-sm text-muted">{v.year}</span>}
                      {d && (
                        <span className={`mt-0.5 block text-xs ${d < today ? "text-red-400" : "text-accent"}`}>
                          {fill(t(d < today ? "garage_overdue" : "garage_next_due"), { date: d.replaceAll("-", ".") })}
                        </span>
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
            className="mt-8 block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black"
          >
            {t("garage_add")}
          </Link>
        </>
      )}
    </main>
  );
}
