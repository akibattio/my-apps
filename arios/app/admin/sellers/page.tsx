import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { sellerOrder } from "@/app/listings/order";
import { PARTY_LABEL } from "../inquiries/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "売りたい人 — ARIOS GARAGE" };

type Row = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  priority: number | null;
  party_type: string | null;
  name: string | null;
  contact: string | null;
  contact_method: string | null;
  vin: string | null;
  created_at: string;
};

const yen = (n: number | null) => (n == null ? "価格未定" : "¥" + Number(n).toLocaleString("ja-JP"));
const methodLabel = (m: string | null) => (m === "LINE" ? "LINE" : m === "PHONE" ? "電話" : "");

export default async function SellersPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select(
      "id, manufacturer, model, price, priority, party_type, name, contact, contact_method, vin, created_at"
    )
    .eq("kind", "SELL")
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  // メーカー×車種でまとめる（同じ車に何人の売り手がいるか）
  const groups = new Map<string, { maker: string; model: string; sellers: Row[] }>();
  for (const r of rows) {
    const maker = (r.manufacturer ?? "").trim();
    const model = (r.model ?? "").trim();
    if (!maker && !model) continue;
    const key = maker.toLowerCase() + "||" + model.toLowerCase();
    if (!groups.has(key)) groups.set(key, { maker, model, sellers: [] });
    groups.get(key)!.sellers.push(r);
  }
  const list = [...groups.values()]
    .map((g) => ({ ...g, sellers: g.sellers.slice().sort(sellerOrder) }))
    .sort((a, b) => b.sellers.length - a.sellers.length);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">売りたい人</h1>
          <p className="mt-1 text-sm text-muted">
            車ごとにまとめて表示（同じ車に複数の売り手＝ブローカー等）。{list.length} 車種 / 全 {rows.length} 件
          </p>
        </div>
        <Link href="/sell" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black">
          ＋売りたいを登録
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ「売りたい」の登録がありません。公開フォーム（/sell）のURLを共有するか、登録から追加してください。
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((g) => (
            <section key={g.maker + "||" + g.model} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="font-medium">
                  {g.maker} {g.model}
                </h2>
                <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                  売り手 {g.sellers.length}名
                </span>
              </div>
              <ul>
                {g.sellers.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 border-t border-white/[0.04] px-4 py-3 first:border-t-0"
                  >
                    <span className="w-5 flex-none text-center text-sm font-semibold text-accent">{i + 1}</span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
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
                        {" ・ "}受付 {new Date(s.created_at).toLocaleDateString("ja-JP")}
                      </div>
                    </div>
                    <Link
                      href={`/admin/inquiries/${s.id}`}
                      className="flex-none rounded-md border border-border px-2 py-1 text-xs text-accent"
                    >
                      詳細
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
