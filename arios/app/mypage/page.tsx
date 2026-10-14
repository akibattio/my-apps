import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import { STATUS_ACTIVE } from "@/app/admin/inquiries/constants";
import { DEAL_STATUS_STYLE } from "@/app/admin/deals/constants";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import LangToggle from "../LangToggle";

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

const yen = (n: number | null, noPrice: string) =>
  n == null ? noPrice : "¥" + Number(n).toLocaleString("ja-JP");
const key = (mk: string | null, md: string | null) =>
  (mk ?? "").trim().toLowerCase() + "||" + (md ?? "").trim().toLowerCase();

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");
  const lang = await getLang();
  const t = tr(lang);
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
      .eq("auth_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("inquiries").select("kind, manufacturer, model").in("status", STATUS_ACTIVE),
  ]);
  const mine = (mineData ?? []) as Row[];

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

  const statusBadge = (r: Row) => {
    const dealStatus = dealByInquiry.get(r.id);
    if (dealStatus) {
      return (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            DEAL_STATUS_STYLE[dealStatus] ?? DEAL_STATUS_STYLE.CANCELLED
          }`}
        >
          {t("my_deal")} {t("deal_" + dealStatus)}
        </span>
      );
    }
    if (hasMatchFor(r)) {
      return (
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
          {t("my_badge_match")}
        </span>
      );
    }
    if (STATUS_ACTIVE.includes(r.status)) {
      return (
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted">
          {t("my_badge_wait")}
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
          {yen(r.price, lang === "en" ? "Price TBD" : "価格未定")} ・ {t("st_" + r.status)}
        </div>
      </div>
      <Link
        href={`/mypage/${r.id}/edit`}
        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-accent"
      >
        {t("edit")}
      </Link>
    </li>
  );

  const section = (title: string, color: string, rows: Row[], emptyHref: string) => (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className={`border-b border-border px-4 py-3 text-xs tracking-wide ${color}`}>
        {title} {rows.length}
        {t("my_count_unit")}
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted">
          {t("my_empty")}
          <Link href={emptyHref} className="ml-1 text-accent">
            {t("my_register")}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">{rows.map(listItem)}</ul>
      )}
    </section>
  );

  const contactMethodLabel =
    meta.contact_method === "LINE" ? t("lineId") : meta.contact_method === "PHONE" ? t("phone") : "";

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="mb-3 flex justify-end">
        <LangToggle lang={lang} />
      </div>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.35em] text-accent">{t("my_eyebrow")}</p>
          <h1 className="mt-1 text-2xl font-semibold">{t("my_title")}</h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-muted">{t("my_desc")}</p>
        </div>
        <form action={signOut}>
          <button className="rounded-full border border-border px-3 py-1.5 text-xs text-muted">
            {t("logout")}
          </button>
        </form>
      </header>

      {/* マッチング状況（常に一番上に表示） */}
      {matched.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-accent/50 bg-accent/10 p-4">
          <p className="text-sm font-semibold text-accent">{t("my_match_has")}</p>
          <p className="mt-1 text-xs text-muted">{t("my_match_has_body")}</p>
          <ul className="mt-2 space-y-1">
            {matched.map((m) => (
              <li key={m.id} className="text-sm">
                ・{m.manufacturer} {m.model}
                <span className="ml-1 text-xs text-muted">
                  （{m.kind === "BUY" ? t("tab_buy") : t("tab_sell")}）
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium">{t("my_match_status")}</p>
          <p className="mt-1 text-xs text-muted">{t("my_match_none")}</p>
        </div>
      )}

      <div className="space-y-4">
        {section(t("my_sell_sec"), "text-accent", sells, "/sell")}
        {section(t("my_buy_sec"), "text-sky-300", buys, "/buy")}
      </div>

      <div className="mt-8 flex gap-3">
        <Link
          href="/sell"
          className="flex-1 rounded-full bg-primary px-4 py-3 text-center text-sm font-semibold text-black"
        >
          {t("my_add_sell")}
        </Link>
        <Link
          href="/buy"
          className="flex-1 rounded-full border border-border px-4 py-3 text-center text-sm"
        >
          {t("my_add_buy")}
        </Link>
      </div>

      {/* 会員情報 */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs tracking-wide text-muted">{t("my_member")}</span>
          <Link href="/mypage/profile" className="text-xs text-accent">
            {t("edit")}
          </Link>
        </div>
        <dl className="divide-y divide-white/[0.04] text-sm">
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">{t("name")}</dt>
            <dd>{meta.name || "—"}</dd>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">{t("company")}</dt>
            <dd>{meta.company || "—"}</dd>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">{t("contact")}</dt>
            <dd>{meta.contact ? `${contactMethodLabel} ${meta.contact}` : "—"}</dd>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <dt className="text-muted">{t("email")}</dt>
            <dd className="text-muted">{user.email}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-8 text-center text-xs text-muted">
        <Link href="/" className="text-accent">
          {t("backTop")}
        </Link>
      </p>
    </main>
  );
}
