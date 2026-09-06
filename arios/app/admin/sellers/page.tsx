import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { sellerOrder } from "@/app/listings/order";
import {
  PARTY_LABEL,
  STATUS_ACTIVE,
  REGISTERED_BY_LABEL,
  REGISTERED_BY_STYLE,
} from "../inquiries/constants";
import RowLink from "../RowLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "売りたい人 — LIFE LINE GARAGE" };

type Row = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  priority: number | null;
  party_type: string | null;
  name: string | null;
  company: string | null;
  registered_by: string;
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
      "id, manufacturer, model, price, priority, party_type, name, company, registered_by, contact, contact_method, vin, created_at"
    )
    .eq("kind", "SELL")
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  // 同じ車（メーカー×車種）が隣り合うよう並べ、その中は安い順（優先順位）に。
  const sorted = rows.slice().sort((a, b) => {
    const ka = `${(a.manufacturer ?? "").toLowerCase()}|${(a.model ?? "").toLowerCase()}`;
    const kb = `${(b.manufacturer ?? "").toLowerCase()}|${(b.model ?? "").toLowerCase()}`;
    if (ka !== kb) return ka < kb ? -1 : 1;
    return sellerOrder(a, b);
  });

  const carCount = new Set(
    rows
      .filter((r) => (r.manufacturer ?? "").trim() || (r.model ?? "").trim())
      .map((r) => `${(r.manufacturer ?? "").toLowerCase()}|${(r.model ?? "").toLowerCase()}`)
  ).size;

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted";
  const td = "whitespace-nowrap px-3 py-2 align-middle";

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">売りたい人</h1>
          <p className="mt-1 text-sm text-muted">
            {carCount} 車種 / 全 {rows.length} 件・同じ車ごとに安い順。行をクリックで詳細
          </p>
        </div>
        <Link href="/admin/new" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black">
          ＋売りたいを登録
        </Link>
      </header>

      {sorted.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ「売りたい」の登録がありません。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className={th}>メーカー</th>
                <th className={th}>車種</th>
                <th className={th}>車体番号</th>
                <th className={th}>販売価格</th>
                <th className={th}>区分</th>
                <th className={th}>連絡先</th>
                <th className={th}>氏名・会社</th>
                <th className={th}>受付</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <RowLink
                  key={s.id}
                  href={`/admin/inquiries/${s.id}`}
                  className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className={`${td} font-medium`}>{s.manufacturer || "—"}</td>
                  <td className={`${td} font-medium`}>{s.model || "—"}</td>
                  <td className={`${td} text-xs text-muted`}>{s.vin || "—"}</td>
                  <td className={`${td} tabular-nums font-medium text-accent`}>{yen(s.price)}</td>
                  <td className={`${td} text-xs text-muted`}>
                    {s.party_type ? PARTY_LABEL[s.party_type] ?? s.party_type : "—"}
                  </td>
                  <td className={`${td} text-xs text-muted`}>
                    {s.contact ? `${methodLabel(s.contact_method)} ${s.contact}` : "—"}
                  </td>
                  <td className={td}>
                    <span className="flex items-center gap-1.5">
                      {s.name || "—"}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          REGISTERED_BY_STYLE[s.registered_by] ?? REGISTERED_BY_STYLE.STAFF
                        }`}
                      >
                        {REGISTERED_BY_LABEL[s.registered_by] ?? "代理"}
                      </span>
                    </span>
                    {s.company && <span className="block text-xs text-muted">{s.company}</span>}
                  </td>
                  <td className={`${td} text-xs text-muted`}>
                    {new Date(s.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  </td>
                  <td className={td}>
                    <Link href={`/admin/inquiries/${s.id}`} className="text-xs text-accent">
                      開く›
                    </Link>
                  </td>
                </RowLink>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
