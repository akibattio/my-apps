import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import RowLink from "../RowLink";
import { DEAL_STATUS_LABEL, DEAL_STATUS_STYLE } from "./constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "取引 — ARIOS GARAGE" };

type Row = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
  agreed_price: number | null;
  contract_date: string | null;
  updated_at: string;
};

const yen = (n: number | null) => (n == null ? "—" : "¥" + Number(n).toLocaleString("ja-JP"));
const md = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" }) : "—";

export default async function DealsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("deals")
    .select("id, manufacturer, model, status, agreed_price, contract_date, updated_at")
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
  const closed = rows.filter((r) => r.status === "CLOSED").length;

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted";
  const td = "whitespace-nowrap px-3 py-2 align-middle";

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">取引（成立したマッチ）</h1>
        <p className="mt-1 text-sm text-muted">
          全 {rows.length} 件 ／ 進行中 {inProgress}・成約 {closed}・行をクリックで詳細
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ取引がありません。「マッチング」の詳細ページで買い×売りを選び「取引にする」で作成できます。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className={th}>状態</th>
                <th className={th}>メーカー</th>
                <th className={th}>車種</th>
                <th className={th}>成約価格</th>
                <th className={th}>成約日</th>
                <th className={th}>更新</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <RowLink
                  key={d.id}
                  href={`/admin/deals/${d.id}`}
                  className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className={td}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        DEAL_STATUS_STYLE[d.status] ?? DEAL_STATUS_STYLE.CANCELLED
                      }`}
                    >
                      {DEAL_STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className={`${td} font-medium`}>{d.manufacturer || "—"}</td>
                  <td className={`${td} font-medium`}>{d.model || "—"}</td>
                  <td className={`${td} tabular-nums text-accent`}>{yen(d.agreed_price)}</td>
                  <td className={`${td} text-xs text-muted`}>{md(d.contract_date)}</td>
                  <td className={`${td} text-xs text-muted`}>{md(d.updated_at)}</td>
                  <td className={td}>
                    <Link href={`/admin/deals/${d.id}`} className="text-xs text-accent">
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
