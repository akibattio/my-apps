import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE } from "../inquiries/constants";
import RowLink from "../RowLink";
import { matchKey } from "./key";
import { bestGradeFull, GRADE_LABEL, GRADE_STYLE } from "./score";

export const dynamic = "force-dynamic";
export const metadata = { title: "マッチング — ARIOS GARAGE" };

type Row = {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  message: string | null;
};

const yen = (n: number | null) => (n == null ? "—" : "¥" + Number(n).toLocaleString("ja-JP"));

export default async function MatchingPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select("id, kind, manufacturer, model, price, message")
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const groups = new Map<
    string,
    { maker: string; model: string; buyers: Row[]; sellers: Row[] }
  >();
  for (const r of rows) {
    const maker = (r.manufacturer ?? "").trim();
    const model = (r.model ?? "").trim();
    if (!maker && !model) continue;
    const key = maker.toLowerCase() + "||" + model.toLowerCase();
    if (!groups.has(key)) groups.set(key, { maker, model, buyers: [], sellers: [] });
    const g = groups.get(key)!;
    if (r.kind === "BUY") g.buyers.push(r);
    else g.sellers.push(r);
  }

  const list = [...groups.values()]
    .map((g) => ({
      ...g,
      isMatch: g.buyers.length > 0 && g.sellers.length > 0,
      grade:
        g.buyers.length > 0 && g.sellers.length > 0
          ? bestGradeFull(g.buyers, g.sellers)
          : null,
      minSell: g.sellers.reduce<number | null>(
        (m, s) => (s.price == null ? m : m == null ? s.price : Math.min(m, s.price)),
        null
      ),
    }))
    .sort((a, b) => {
      if (a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1;
      return b.buyers.length + b.sellers.length - (a.buyers.length + a.sellers.length);
    });

  const matchCount = list.filter((g) => g.isMatch).length;
  const buyTotal = rows.filter((r) => r.kind === "BUY").length;
  const sellTotal = rows.filter((r) => r.kind === "SELL").length;

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted";
  const td = "whitespace-nowrap px-3 py-2 align-middle";

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">マッチング</h1>
          <p className="mt-1 text-sm text-muted">
            マッチ {matchCount} 件 ／ 買い {buyTotal}・売り {sellTotal}・行をクリックで詳細
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/admin/new" className="rounded-full bg-primary px-4 py-2 font-semibold text-black">
            ＋登録
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ登録がありません。「買いたい」「売りたい」から登録してください。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className={th}>状態</th>
                <th className={th}>メーカー</th>
                <th className={th}>車種</th>
                <th className={th}>買いたい</th>
                <th className={th}>売りたい</th>
                <th className={th}>最安売値</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <RowLink
                  key={g.maker + "||" + g.model}
                  href={`/admin/matching/${matchKey(g.maker, g.model)}`}
                  className={`border-t border-white/[0.04] hover:bg-white/[0.02] ${
                    g.isMatch ? "bg-accent/[0.04]" : ""
                  }`}
                >
                  <td className={td}>
                    {g.isMatch && g.grade ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${GRADE_STYLE[g.grade]}`}
                        title="価格による成立可能性"
                      >
                        {GRADE_LABEL[g.grade]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className={`${td} font-medium`}>{g.maker || "—"}</td>
                  <td className={`${td} font-medium`}>{g.model || "—"}</td>
                  <td className={`${td} tabular-nums`}>
                    <span className={g.buyers.length ? "text-sky-300" : "text-muted"}>
                      {g.buyers.length}名
                    </span>
                  </td>
                  <td className={`${td} tabular-nums`}>
                    <span className={g.sellers.length ? "text-accent" : "text-muted"}>
                      {g.sellers.length}名
                    </span>
                  </td>
                  <td className={`${td} tabular-nums text-muted`}>{yen(g.minSell)}</td>
                  <td className={td}>
                    <Link
                      href={`/admin/matching/${matchKey(g.maker, g.model)}`}
                      className="text-xs text-accent"
                    >
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
