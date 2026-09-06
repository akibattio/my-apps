import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { STATUS_LABEL, STATUS_ACTIVE } from "@/app/admin/inquiries/constants";
import { DEAL_STATUS_LABEL, DEAL_STATUS_STYLE } from "@/app/admin/deals/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイページ — LIFE LINE GARAGE" };

type Row = {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  status: string;
  message: string | null;
  contact: string | null;
  name: string | null;
  created_at: string;
};

const yen = (n: number | null) => (n == null ? "価格未定" : "¥" + Number(n).toLocaleString("ja-JP"));
const key = (mk: string | null, md: string | null) =>
  (mk ?? "").trim().toLowerCase() + "||" + (md ?? "").trim().toLowerCase();

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const email = (user.email ?? "").toLowerCase();
  const meta = (user.user_metadata ?? {}) as {
    name?: string;
    company?: string;
    contact?: string;
    contact_method?: string;
  };

  const supabase = createAdminClient();
  const [{ data: mineData }, { data: activeData }] = await Promise.all([
    supabase
      .from("inquiries")
      .select("id, kind, manufacturer, model, price, status, message, contact, name, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false }),
    supabase.from("inquiries").select("kind, manufacturer, model").in("status", STATUS_ACTIVE),
  ]);
  const mine = (mineData ?? []) as Row[];

  // 自分の依頼が「取引」に紐付いているか（進捗表示用）。依頼ID → 取引ステータス。
  const dealByInquiry = new Map<string, string>();
  const mineIds = mine.map((r) => r.id);
  if (mineIds.length > 0) {
    const [{ data: asBuyer }, { data: asSeller }] = await Promise.all([
      supabase.from("deals").select("status, buyer_inquiry_id").in("buyer_inquiry_id", mineIds),
      supabase.from("deals").select("status, seller_inquiry_id").in("seller_inquiry_id", mineIds),
    ]);
    for (const d of asBuyer ?? []) if (d.buyer_inquiry_id) dealByInquiry.set(d.buyer_inquiry_id, d.status);
    for (const d of asSeller ?? []) if (d.seller_inquiry_id) dealByInquiry.set(d.seller_inquiry_id, d.status);
  }

  // マッチ判定用: 有効な依頼の「種別:メーカー×車種」集合。
  const present = new Set<string>();
  for (const r of activeData ?? []) present.add(`${r.kind}:${key(r.manufacturer, r.model)}`);

  const hasMatchFor = (r: Row) => {
    if (!STATUS_ACTIVE.includes(r.status)) return false;
    if (dealByInquiry.has(r.id)) return false;
    const opposite = r.kind === "BUY" ? "SELL" : "BUY";
    return present.has(`${opposite}:${key(r.manufacturer, r.model)}`);
  };
  const matched = mine.filter(hasMatchFor);

  const sells = mine.filter((r) => r.kind === "SELL");
  const buys = mine.filter((r) => r.kind === "BUY");

  // 1件ごとのマッチ状況バッジ: 取引中 → マッチあり → マッチ待ち。
  const statusBadge = (r: Row) => {
    const dealStatus = dealByInquiry.get(r.id);
    if (dealStatus) {
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            DEAL_STATUS_STYLE[dealStatus] ?? DEAL_STATUS_STYLE.CANCELLED
          }`}
        >
          取引 {DEAL_STATUS_LABEL[dealStatus] ?? dealStatus}
        </span>
      );
    }
    if (hasMatchFor(r)) {
      return (
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
          🔔 マッチあり
        </span>
      );
    }
    if (STATUS_ACTIVE.includes(r.status)) {
      return (
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted">
          マッチ待ち
        </span>
      );
    }
    return null;
  };

  const listItem = (r: Row) => (
    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">
            {r.manufacturer || "—"} {r.model || ""}
          </span>
          {statusBadge(r)}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {yen(r.price)} ・ {STATUS_LABEL[r.status] ?? r.status}
        </div>
      </div>
      <Link
        href={`/mypage/${r.id}/edit`}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-accent"
      >
        編集
      </Link>
    </li>
  );

  const section = (title: string, color: string, rows: Row[], emptyHref: string, emptyLabel: string) => (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className={`border-b border-border px-4 py-3 text-xs tracking-wide ${color}`}>
        {title} {rows.length}件
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted">
          まだありません。
          <Link href={emptyHref} className="ml-1 text-accent">
            {emptyLabel}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">{rows.map(listItem)}</ul>
      )}
    </section>
  );

  const contactMethodLabel =
    meta.contact_method === "LINE" ? "LINE" : meta.contact_method === "PHONE" ? "電話" : "";

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.35em] text-accent">MY PAGE</p>
          <h1 className="mt-1 text-2xl font-semibold">マイページ</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-muted">
            マッチング状況・登録＆リクエスト情報・会員情報
          </p>
        </div>
        <form action={signOut}>
          <button className="rounded-full border border-border px-3 py-1.5 text-xs text-muted">
            ログアウト
          </button>
        </form>
      </header>

      {/* マッチング状況（常に一番上に表示） */}
      {matched.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-accent/50 bg-accent/10 p-4">
          <p className="text-sm font-semibold text-accent">🔔 マッチングがあります</p>
          <p className="mt-1 text-xs text-muted">
            以下の車で、条件の合う相手が見つかっています。ARIOSからのご連絡をお待ちください。
          </p>
          <ul className="mt-2 space-y-1">
            {matched.map((m) => (
              <li key={m.id} className="text-sm">
                ・{m.manufacturer} {m.model}
                <span className="ml-1 text-xs text-muted">
                  （{m.kind === "BUY" ? "買いたい" : "売りたい"}）
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">マッチング状況</p>
          <p className="mt-1 text-xs text-muted">
            現在、新しいマッチングはありません。見つかり次第ここでお知らせします。
          </p>
        </div>
      )}

      <div className="space-y-4">
        {section("🚗 売りたい（登録した車）", "text-accent", sells, "/sell", "登録する")}
        {section("🔎 買いたい（探している車）", "text-sky-300", buys, "/buy", "登録する")}
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/sell"
          className="flex-1 rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-black"
        >
          ＋ 売りたいを登録
        </Link>
        <Link
          href="/buy"
          className="flex-1 rounded-full border border-border px-4 py-3 text-center text-sm"
        >
          ＋ 買いたいを登録
        </Link>
      </div>

      {/* 個人情報（登録情報）*/}
      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs tracking-wide text-muted">会員情報</span>
          <Link href="/mypage/profile" className="text-xs text-accent">
            編集
          </Link>
        </div>
        <dl className="divide-y divide-white/[0.04] text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">お名前</dt>
            <dd>{meta.name || "—"}</dd>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">会社名</dt>
            <dd>{meta.company || "—"}</dd>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">連絡先</dt>
            <dd>{meta.contact ? `${contactMethodLabel} ${meta.contact}` : "—"}</dd>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">メール</dt>
            <dd className="text-muted">{user.email}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/" className="text-accent">
          トップへ戻る
        </Link>
      </p>
    </main>
  );
}
