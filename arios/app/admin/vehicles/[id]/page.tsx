import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwIfDbError } from "@/lib/db";
import { PARTY_LABEL, STATUS_LABEL } from "../../inquiries/constants";
import { decideClaim } from "../actions";
import { tr } from "@/lib/i18n";

const ja = tr("ja");

export const dynamic = "force-dynamic";
export const metadata = { title: "車両の記録 — LIFE LINE GARAGE" };

const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "公開",
  PRIVATE: "本人のみ",
  ADMIN: "運営のみ",
};
const CLAIM_LABEL: Record<string, string> = {
  PENDING: "確認待ち",
  APPROVED: "認めた",
  REJECTED: "認めなかった",
};

type OwnerRef = { name: string | null; email: string | null } | { name: string | null; email: string | null }[] | null;
const one = (o: OwnerRef) => (Array.isArray(o) ? o[0] : o) ?? null;
const yen = (n: number | null) => (n != null ? "¥" + n.toLocaleString("ja-JP") : "—");

// 車体番号ごとの車の記録（運営用）。つながっている売りたい登録・経緯・持ち主の確認待ちをまとめて見る。
export default async function AdminVehicleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: v, error } = await supabase
    .from("vehicles")
    .select("id, vin, manufacturer, model, year, source, is_public, created_at, owner:current_owner_id(name, email)")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error, "admin/vehicles/[id]");
  if (!v) notFound();

  const [
    { data: listings, error: lErr },
    { data: histories, error: hErr },
    { data: claims, error: cErr },
  ] = await Promise.all([
    supabase
      .from("inquiries")
      .select("id, kind, party_type, name, company, price, status, created_at")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("histories")
      .select("id, history_type, title, description, event_date, next_due_date, links, source, visibility, created_at, owner:owner_id(name, email)")
      .eq("vehicle_id", id)
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("vehicle_claims")
      .select("id, status, inquiry_id, created_at, decided_at, owner:owner_id(name, email)")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false }),
  ]);
  throwIfDbError(lErr ?? hErr ?? cErr, "admin/vehicles/[id]");

  const owner = one(v.owner as OwnerRef);
  const name = [v.manufacturer, v.model].filter(Boolean).join(" ") || "名称未設定の車両";

  return (
    <div className="max-w-2xl">
      <Link href="/admin/vehicles" className="text-sm text-accent hover:underline">
        ‹ 車両の一覧
      </Link>
      <h1 className="mt-3 text-xl font-semibold">
        {name}
        {v.year ? <span className="text-muted"> · {v.year}</span> : null}
      </h1>
      <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
        <dt className="text-muted">車体番号</dt>
        <dd className="font-mono">{v.vin ?? "—"}</dd>
        <dt className="text-muted">持ち主</dt>
        <dd>{owner ? `${owner.name ?? "—"}${owner.email && owner.email !== owner.name ? `（${owner.email}）` : ""}` : "未設定"}</dd>
        <dt className="text-muted">公開ページ</dt>
        <dd>
          {v.is_public ? (
            <Link href={`/passport/${v.id}`} className="text-accent hover:underline">
              公開中（見る）
            </Link>
          ) : (
            "非公開"
          )}
        </dd>
        <dt className="text-muted">記録の開始</dt>
        <dd className="tabular-nums">{v.created_at.slice(0, 10)}</dd>
      </dl>

      {(claims ?? []).length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">持ち主の確認</h2>
          <p className="mb-3 text-xs text-muted">
            別の会員が「オーナー」としてこの車体番号で登録しました。持ち主が代わった・入力ミス・なりすましの可能性があります。
            両方の会員に確認してから判断してください。認めると持ち主が切り替わり、前の持ち主のマイガレージからは外れます。
          </p>
          <ul className="space-y-2">
            {(claims ?? []).map((c) => {
              const co = one(c.owner as OwnerRef);
              return (
                <li key={c.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {co?.email ?? co?.name ?? "—"}
                      <span className="ml-2 text-xs text-muted">{c.created_at.slice(0, 10)}</span>
                    </span>
                    <span className={c.status === "PENDING" ? "text-amber-300" : "text-muted"}>
                      {CLAIM_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  {c.inquiry_id && (
                    <Link href={`/admin/inquiries/${c.inquiry_id}`} className="mt-1 inline-block text-xs text-accent hover:underline">
                      この会員の売りたい登録を見る
                    </Link>
                  )}
                  {c.status === "PENDING" && (
                    <div className="mt-3 flex gap-2">
                      <form action={decideClaim}>
                        <input type="hidden" name="claimId" value={c.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-black">
                          持ち主として認める
                        </button>
                      </form>
                      <form action={decideClaim}>
                        <input type="hidden" name="claimId" value={c.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <button className="rounded-full border border-border px-4 py-2 text-xs text-muted">
                          認めない
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">つながっている登録（{(listings ?? []).length}）</h2>
        {(listings ?? []).length === 0 ? (
          <p className="text-sm text-muted">ありません。</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {(listings ?? []).map((l) => (
              <li key={l.id}>
                <Link href={`/admin/inquiries/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/5">
                  <span>
                    {l.kind === "SELL" ? "売りたい" : "買いたい"}
                    {l.party_type ? `（${PARTY_LABEL[l.party_type] ?? l.party_type}）` : ""}
                    <span className="ml-2">{l.name ?? "—"}{l.company ? ` / ${l.company}` : ""}</span>
                  </span>
                  <span className="flex-none text-xs text-muted">
                    {yen(l.price)} · {STATUS_LABEL[l.status] ?? l.status} · {l.created_at.slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">記録（{(histories ?? []).length}）</h2>
        <ol className="space-y-3 border-l border-neutral-700 pl-5">
          {(histories ?? []).map((h) => {
            const ho = one(h.owner as OwnerRef);
            return (
              <li key={h.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="tabular-nums text-accent">{(h.event_date ?? h.created_at.slice(0, 10)).replaceAll("-", ".")}</span>
                  <span className="font-medium">
                    {h.title ?? (h.source === "MEMBER_REGISTRATION" ? ja("ht_registered") : ja(`ht_${h.history_type}`))}
                  </span>
                  <span className="rounded-full border border-border px-2 text-[11px] text-muted">
                    {VISIBILITY_LABEL[h.visibility] ?? h.visibility}
                  </span>
                </div>
                {h.description && <p className="mt-1 text-muted">{h.description}</p>}
                {h.next_due_date && <p className="mt-0.5 text-xs text-accent">次回予定: {h.next_due_date}</p>}
                {(h.links ?? []).length > 0 && (
                  <p className="mt-0.5 break-all text-xs text-muted">{(h.links as string[]).join("  ")}</p>
                )}
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  入力: {ho?.email ?? ho?.name ?? "運営"} · {h.source ?? "—"}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
