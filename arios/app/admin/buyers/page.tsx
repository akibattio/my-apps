import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_ACTIVE } from "../inquiries/constants";

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

const yen = (n: number | null) =>
  n == null ? "希望価格の記載なし" : "希望 ¥" + Number(n).toLocaleString("ja-JP");
const methodLabel = (m: string | null) => (m === "LINE" ? "LINE" : m === "PHONE" ? "電話" : "");

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

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">買いたい人</h1>
          <p className="mt-1 text-sm text-muted">
            「こういう車が欲しい」という依頼。全 {list.length} 件
          </p>
        </div>
        <Link href="/buy" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black">
          ＋買いたいを登録
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ「買いたい」の依頼がありません。LINE等で相談が来たら、公開フォーム（/buy）を渡して入力してもらいましょう。
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => {
            const car = [b.manufacturer, b.model].filter(Boolean).join(" ") || "車種未設定";
            const dt = new Date(b.created_at);
            return (
              <li key={b.id}>
                <Link
                  href={`/admin/inquiries/${b.id}`}
                  className="block rounded-2xl border border-border bg-card p-4 active:border-accent/40"
                >
                  {/* いつ・どの経路で・誰から */}
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>
                      受付 {dt.toLocaleDateString("ja-JP")}{" "}
                      {dt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {b.channel && (
                      <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-sky-300">
                        {CHANNEL_LABEL[b.channel] ?? b.channel}
                      </span>
                    )}
                    <span className="ml-auto rounded-full border border-border px-2 py-0.5">
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </div>

                  <div className="font-medium">{car}</div>
                  <div className="mt-0.5 text-sm text-accent">{yen(b.price)}</div>

                  <div className="mt-1 text-sm text-muted">
                    依頼者: {b.name || "（氏名未記入）"}
                    {b.contact ? ` ／ ${methodLabel(b.contact_method)} ${b.contact}` : ""}
                  </div>
                  {b.message && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{b.message}</p>
                  )}
                  {b.next_action_date && (
                    <p className="mt-1 inline-block rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">
                      次アクション {b.next_action_date.replaceAll("-", "/")}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
