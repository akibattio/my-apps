import { Fragment } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { sellerOrder } from "@/app/listings/order";
import { PARTY_LABEL, STATUS_ACTIVE } from "../inquiries/constants";

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
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

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

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted";
  const td = "whitespace-nowrap px-3 py-2 align-middle";

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">売りたい人</h1>
          <p className="mt-1 text-sm text-muted">
            車ごと（同じ車に複数の売り手＝ブローカー等）。{list.length} 車種 / 全 {rows.length} 件・安い順
          </p>
        </div>
        <Link href="/admin/new" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black">
          ＋売りたいを登録
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ「売りたい」の登録がありません。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className={`${th} w-10`}>#</th>
                <th className={th}>販売価格</th>
                <th className={th}>区分</th>
                <th className={th}>連絡先</th>
                <th className={th}>氏名・会社</th>
                <th className={th}>車体番号</th>
                <th className={th}>受付</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <Fragment key={g.maker + "||" + g.model}>
                  <tr className="border-t border-border bg-white/[0.03]">
                    <td className="px-3 py-2 text-xs font-semibold" colSpan={8}>
                      {g.maker} {g.model}
                      <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                        売り手 {g.sellers.length}名
                      </span>
                    </td>
                  </tr>
                  {g.sellers.map((s, i) => (
                    <tr key={s.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                      <td className={`${td} text-center text-accent`}>{i + 1}</td>
                      <td className={`${td} tabular-nums font-medium`}>{yen(s.price)}</td>
                      <td className={`${td} text-xs text-muted`}>
                        {s.party_type ? PARTY_LABEL[s.party_type] ?? s.party_type : "—"}
                      </td>
                      <td className={`${td} text-xs text-muted`}>
                        {s.contact ? `${methodLabel(s.contact_method)} ${s.contact}` : "—"}
                      </td>
                      <td className={td}>{s.name || "—"}</td>
                      <td className={`${td} text-xs text-muted`}>{s.vin || "—"}</td>
                      <td className={`${td} text-xs text-muted`}>
                        {new Date(s.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                      </td>
                      <td className={td}>
                        <Link href={`/admin/inquiries/${s.id}`} className="text-xs text-accent">
                          開く›
                        </Link>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
