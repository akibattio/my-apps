import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { reorderSeller } from "@/app/listings/actions";
import { sellerOrder } from "@/app/listings/order";
import { PARTY_LABEL, STATUS_ACTIVE } from "../inquiries/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "マッチング — ARIOS GARAGE" };

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

const yen = (n: number | null) =>
  n == null ? "価格未定" : "¥" + n.toLocaleString("ja-JP");
const methodLabel = (m: string | null) =>
  m === "LINE" ? "LINE" : m === "PHONE" ? "電話" : "";

export default async function MatchingPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select(
      "id, kind, manufacturer, model, price, priority, party_type, name, contact, contact_method, message, vin"
    )
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const groups = new Map<
    string,
    { maker: string; model: string; sellers: Row[]; buyers: Row[] }
  >();
  for (const r of rows) {
    const maker = (r.manufacturer ?? "").trim();
    const model = (r.model ?? "").trim();
    if (!maker && !model) continue;
    const key = maker.toLowerCase() + "||" + model.toLowerCase();
    if (!groups.has(key)) groups.set(key, { maker, model, sellers: [], buyers: [] });
    const g = groups.get(key)!;
    if (r.kind === "BUY") g.buyers.push(r);
    else g.sellers.push(r);
  }

  const list = [...groups.values()]
    .map((g) => ({ ...g, sellers: g.sellers.slice().sort(sellerOrder) }))
    .sort((a, b) => {
      const ma = a.sellers.length > 0 && a.buyers.length > 0 ? 1 : 0;
      const mb = b.sellers.length > 0 && b.buyers.length > 0 ? 1 : 0;
      if (ma !== mb) return mb - ma;
      return b.sellers.length + b.buyers.length - (a.sellers.length + a.buyers.length);
    });

  const matchCount = list.filter((g) => g.sellers.length > 0 && g.buyers.length > 0).length;
  const buyTotal = rows.filter((r) => r.kind === "BUY").length;
  const sellTotal = rows.filter((r) => r.kind === "SELL").length;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">マッチング</h1>
          <p className="mt-1 text-sm text-muted">
            マッチ {matchCount} 件 ／ 買い {buyTotal}・売り {sellTotal}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/buy" className="rounded-full border border-border px-4 py-2 text-muted">
            ＋買いたい
          </Link>
          <Link href="/sell" className="rounded-full bg-primary px-4 py-2 font-semibold text-black">
            ＋売りたい
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ登録がありません。「＋買いたい」「＋売りたい」から登録するか、公開フォームのURLを共有してください。
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((g) => {
            const isMatch = g.sellers.length > 0 && g.buyers.length > 0;
            return (
              <section
                key={g.maker + "||" + g.model}
                className={`overflow-hidden rounded-2xl border bg-card ${
                  isMatch ? "border-accent/50" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <h2 className="font-medium">
                    {g.maker} {g.model}
                  </h2>
                  <div className="flex items-center gap-2 text-xs">
                    {isMatch && (
                      <span className="rounded-full bg-accent/15 px-2.5 py-1 font-medium text-accent">
                        マッチ
                      </span>
                    )}
                    <span className="text-muted">
                      買い {g.buyers.length}・売り {g.sellers.length}
                    </span>
                  </div>
                </div>

                {/* 買いたい */}
                {g.buyers.length > 0 && (
                  <div className="border-b border-white/[0.04] px-4 py-3">
                    <p className="mb-2 text-xs tracking-wide text-sky-300">買いたい {g.buyers.length}名</p>
                    <ul className="space-y-2">
                      {g.buyers.map((b) => (
                        <li key={b.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">希望 {yen(b.price)}</span>
                            <span className="text-xs text-muted">
                              {methodLabel(b.contact_method)} {b.contact ?? ""}
                            </span>
                          </div>
                          {b.message && (
                            <p className="mt-1 text-xs leading-relaxed text-muted">{b.message}</p>
                          )}
                          {b.name && <p className="mt-1 text-xs text-muted">{b.name}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 売りたい（安い順・優先順位変更可） */}
                {g.sellers.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="mb-2 text-xs tracking-wide text-accent">
                      売りたい {g.sellers.length}名（販売価格の安い順）
                    </p>
                    <ul className="space-y-2">
                      {g.sellers.map((s, i) => (
                        <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
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
                                disabled={i === g.sellers.length - 1}
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
                    <p className="mt-2 text-[11px] text-muted">
                      ※ オーナーに近い順に売りたいため、価格の安い順を基本にARIOSが順位調整できます（↑↓）。
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
