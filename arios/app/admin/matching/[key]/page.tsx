import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { reorderSeller } from "@/app/listings/actions";
import { sellerOrder } from "@/app/listings/order";
import { PARTY_LABEL, STATUS_ACTIVE } from "../../inquiries/constants";
import { parseMatchKey } from "../key";

export const dynamic = "force-dynamic";
export const metadata = { title: "マッチング詳細 — ARIOS GARAGE" };

type Row = {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  priority: number | null;
  party_type: string | null;
  name: string | null;
  contact: string | null;
  contact_method: string | null;
  message: string | null;
  vin: string | null;
};

const yen = (n: number | null) => (n == null ? "価格未定" : "¥" + Number(n).toLocaleString("ja-JP"));
const methodLabel = (m: string | null) => (m === "LINE" ? "LINE" : m === "PHONE" ? "電話" : "");

export default async function MatchingDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const { maker, model } = parseMatchKey(key);
  if (!maker && !model) notFound();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select(
      "id, kind, manufacturer, model, price, priority, party_type, name, contact, contact_method, message, vin"
    )
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: false });

  const mk = maker.toLowerCase();
  const md = model.toLowerCase();
  const rows = ((data ?? []) as Row[]).filter(
    (r) =>
      (r.manufacturer ?? "").trim().toLowerCase() === mk &&
      (r.model ?? "").trim().toLowerCase() === md
  );

  const buyers = rows.filter((r) => r.kind === "BUY");
  const sellers = rows.filter((r) => r.kind !== "BUY").sort(sellerOrder);
  const isMatch = buyers.length > 0 && sellers.length > 0;

  return (
    <div>
      <Link href="/admin/matching" className="text-sm text-accent">
        ‹ マッチング一覧へ
      </Link>

      <header className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          {maker} {model}
        </h1>
        {isMatch && (
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
            マッチ
          </span>
        )}
        <span className="text-sm text-muted">
          買い {buyers.length}・売り {sellers.length}
        </span>
      </header>

      {/* 買いたい */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-xs tracking-wide text-sky-300">
          買いたい {buyers.length}名
        </div>
        {buyers.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">買いたい人はまだいません。</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {buyers.map((b) => (
              <li key={b.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">希望 {yen(b.price)}</span>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      {methodLabel(b.contact_method)} {b.contact ?? ""}
                      {b.name ? ` ・ ${b.name}` : ""}
                    </span>
                    <Link href={`/admin/inquiries/${b.id}`} className="text-accent">
                      詳細›
                    </Link>
                  </div>
                </div>
                {b.message && (
                  <p className="mt-1 text-xs leading-relaxed text-muted">{b.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 売りたい（安い順・優先順位変更可） */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-xs tracking-wide text-accent">
          売りたい {sellers.length}名（販売価格の安い順・↑↓で優先順位を調整）
        </div>
        {sellers.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">売りたい人はまだいません。</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {sellers.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 px-4 py-3">
                <span className="w-5 flex-none text-center text-sm font-semibold text-accent">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{yen(s.price)}</span>
                    {s.party_type && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                        {PARTY_LABEL[s.party_type] ?? s.party_type}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {methodLabel(s.contact_method)} {s.contact ?? ""}
                    {s.name ? ` ・ ${s.name}` : ""}
                    {s.vin ? ` ・ 車体 ${s.vin}` : ""}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <form action={reorderSeller}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button
                      type="submit"
                      disabled={i === 0}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted disabled:opacity-30"
                      aria-label="上へ"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={reorderSeller}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      type="submit"
                      disabled={i === sellers.length - 1}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted disabled:opacity-30"
                      aria-label="下へ"
                    >
                      ↓
                    </button>
                  </form>
                  <Link
                    href={`/admin/inquiries/${s.id}`}
                    className="rounded-md border border-border px-2 py-1 text-xs text-accent"
                  >
                    詳細
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 py-3 text-[11px] text-muted">
          ※ 販売価格の安い順を基本に、ARIOSが順位を調整できます（↑↓）。
        </p>
      </section>
    </div>
  );
}
