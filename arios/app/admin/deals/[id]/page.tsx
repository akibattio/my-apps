import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEAL_STATUS_LABEL,
  DEAL_STATUS_FLOW,
  DEAL_STATUS_STYLE,
} from "../constants";
import { KIND_LABEL } from "../../inquiries/constants";
import { saveDealContract, setDealStatus, addDealEvent } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "取引の詳細 — LIFE LINE GARAGE" };

type Deal = {
  id: string;
  buyer_inquiry_id: string | null;
  seller_inquiry_id: string | null;
  manufacturer: string | null;
  model: string | null;
  status: string;
  agreed_price: number | null;
  contract_date: string | null;
  note: string | null;
  created_at: string;
};

type Party = {
  id: string;
  kind: string;
  price: number | null;
  name: string | null;
  contact: string | null;
  contact_method: string | null;
};

type Event = { id: string; body: string; created_at: string };

const yen = (n: number | null) => (n == null ? "—" : "¥" + Number(n).toLocaleString("ja-JP"));
const dt = (s: string) =>
  new Date(s).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, buyer_inquiry_id, seller_inquiry_id, manufacturer, model, status, agreed_price, contract_date, note, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!deal) notFound();
  const d = deal as Deal;

  const partyIds = [d.buyer_inquiry_id, d.seller_inquiry_id].filter(
    (x): x is string => !!x
  );
  const parties: Party[] = partyIds.length
    ? (
        (
          await supabase
            .from("inquiries")
            .select("id, kind, price, name, contact, contact_method")
            .in("id", partyIds)
        ).data ?? []
      ) as Party[]
    : [];
  const buyer = parties.find((p) => p.id === d.buyer_inquiry_id);
  const seller = parties.find((p) => p.id === d.seller_inquiry_id);

  const { data: evData } = await supabase
    .from("deal_events")
    .select("id, body, created_at")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });
  const events = (evData ?? []) as Event[];

  const label = "text-xs text-muted";
  const partyCard = (title: string, color: string, p?: Party) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className={`mb-1 text-xs ${color}`}>{title}</p>
      {p ? (
        <>
          <p className="text-sm font-medium">{yen(p.price)}</p>
          <p className="mt-0.5 text-xs text-muted">
            {p.name || "—"}
            {p.contact ? ` ・ ${p.contact}` : ""}
          </p>
          <Link href={`/admin/inquiries/${p.id}`} className="mt-1 inline-block text-xs text-accent">
            依頼の詳細›
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted">紐付けなし</p>
      )}
    </div>
  );

  return (
    <div>
      <Link href="/admin/deals" className="text-sm text-accent">
        ‹ 取引一覧へ
      </Link>

      <header className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          {d.manufacturer} {d.model}
        </h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            DEAL_STATUS_STYLE[d.status] ?? DEAL_STATUS_STYLE.CANCELLED
          }`}
        >
          {DEAL_STATUS_LABEL[d.status] ?? d.status}
        </span>
      </header>

      {/* 買い×売りの紐付け */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {partyCard(`買いたい（${KIND_LABEL.BUY}）`, "text-sky-300", buyer)}
        {partyCard(`売りたい（${KIND_LABEL.SELL}）`, "text-accent", seller)}
      </div>

      {/* 状態変更 */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">状態</p>
        <div className="flex flex-wrap gap-2">
          {DEAL_STATUS_FLOW.map((s) => (
            <form key={s} action={setDealStatus}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                disabled={d.status === s}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  d.status === s
                    ? "bg-primary font-semibold text-black"
                    : "border border-border text-muted hover:text-foreground"
                }`}
              >
                {DEAL_STATUS_LABEL[s]}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">
          ※「成約」にすると、紐付いた買い/売りの依頼も成約になり、買いたい/売りたい/マッチングの一覧から外れます。
        </p>
      </section>

      {/* 契約情報 */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">契約情報</p>
        <form action={saveDealContract} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={d.id} />
          <label className="block">
            <span className={label}>成約価格</span>
            <input
              name="agreedPrice"
              type="text"
              inputMode="numeric"
              defaultValue={d.agreed_price ?? ""}
              placeholder="例）12,000,000"
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className={label}>成約日</span>
            <input
              name="contractDate"
              type="date"
              defaultValue={d.contract_date ?? ""}
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={label}>メモ</span>
            <textarea
              name="note"
              rows={3}
              defaultValue={d.note ?? ""}
              placeholder="契約条件・特記事項など"
              className="mt-1 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black"
            >
              保存
            </button>
          </div>
        </form>
      </section>

      {/* 進行履歴タイムライン */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">進行履歴</p>
        <form action={addDealEvent} className="mb-4 flex gap-2">
          <input type="hidden" name="id" value={d.id} />
          <input
            name="body"
            type="text"
            placeholder="例）買主に連絡、条件提示 など"
            className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full border border-accent px-4 py-2 text-sm text-accent"
          >
            追加
          </button>
        </form>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">まだ履歴がありません。</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <div>
                  <p>{e.body}</p>
                  <p className="text-[11px] text-muted">{dt(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
