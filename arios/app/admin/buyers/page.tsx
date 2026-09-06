import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_ACTIVE } from "../inquiries/constants";
import RowLink from "../RowLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "買いたい人 — ARIOS GARAGE" };

type Row = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  name: string | null;
  contact: string | null;
  contact_method: string | null;
  channel: string | null;
  message: string | null;
  status: string;
  next_action_date: string | null;
  created_at: string;
};

const yen = (n: number | null) => (n == null ? "—" : "¥" + Number(n).toLocaleString("ja-JP"));
const methodLabel = (m: string | null) => (m === "LINE" ? "LINE" : m === "PHONE" ? "電話" : "");
const STATUS_STYLE: Record<string, string> = {
  NEW: "text-accent bg-accent/10",
  CONTACTED: "text-sky-300 bg-sky-400/10",
  NEGOTIATING: "text-primary bg-primary/10",
  CLOSED: "text-emerald-300 bg-emerald-400/10",
  DROPPED: "text-muted bg-white/5",
};

export default async function BuyersPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select(
      "id, manufacturer, model, price, name, contact, contact_method, channel, message, status, next_action_date, created_at"
    )
    .eq("kind", "BUY")
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: false });
  const list = (data ?? []) as Row[];

  const th = "whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted";
  const td = "whitespace-nowrap px-3 py-2 align-middle";

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">買いたい人</h1>
          <p className="mt-1 text-sm text-muted">「こういう車が欲しい」という依頼。全 {list.length} 件</p>
        </div>
        <Link href="/admin/new" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black">
          ＋買いたいを登録
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ「買いたい」の依頼がありません。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                <th className={th}>日付</th>
                <th className={th}>依頼者</th>
                <th className={th}>メーカー</th>
                <th className={th}>車種</th>
                <th className={th}>希望価格</th>
                <th className={th}>経路</th>
                <th className={th}>連絡先</th>
                <th className={th}>状態</th>
                <th className={th}>次アクション</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <RowLink
                  key={b.id}
                  href={`/admin/inquiries/${b.id}`}
                  className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                >
                  <td className={`${td} text-xs text-muted`}>
                    {new Date(b.created_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
                  </td>
                  <td className={`${td} font-medium`}>{b.name || "—"}</td>
                  <td className={`${td} font-medium`}>{b.manufacturer || "—"}</td>
                  <td className={`${td} font-medium`}>{b.model || "—"}</td>
                  <td className={`${td} tabular-nums text-accent`}>{yen(b.price)}</td>
                  <td className={`${td} text-xs text-muted`}>
                    {b.channel ? CHANNEL_LABEL[b.channel] ?? b.channel : "—"}
                  </td>
                  <td className={`${td} text-xs text-muted`}>
                    {b.contact ? `${methodLabel(b.contact_method)} ${b.contact}` : "—"}
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[b.status] ?? STATUS_STYLE.DROPPED}`}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className={`${td} text-xs ${b.next_action_date ? "text-primary" : "text-muted"}`}>
                    {b.next_action_date ? b.next_action_date.replaceAll("-", "/") : "—"}
                  </td>
                  <td className={td}>
                    <Link href={`/admin/inquiries/${b.id}`} className="text-xs text-accent">
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
