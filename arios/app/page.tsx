import Link from "next/link";
import Wordmark from "./Wordmark";
import LangToggle from "./LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE } from "@/app/admin/inquiries/constants";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

// Top（公開）。未ログイン=会員登録/ログイン。ログイン後=マッチ通知＋売りたい/買いたい/マイページ。
export const dynamic = "force-dynamic";

const key = (mk: string | null, md: string | null) =>
  (mk ?? "").trim().toLowerCase() + "||" + (md ?? "").trim().toLowerCase();

export default async function Home() {
  const lang = await getLang();
  const t = tr(lang);
  const user = await getCurrentUser();

  // 未ログイン: 会員登録 / ログイン
  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
        <div className="mb-6 flex justify-end">
          <LangToggle lang={lang} />
        </div>
        <header className="text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <h1 className="mt-8 text-2xl leading-snug font-semibold">
            {t("top_hero1")}
            <br />
            {t("top_hero2")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">{t("top_lead_guest")}</p>
        </header>

        <div className="mt-8 space-y-3">
          <Link
            href="/signup"
            className="block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black"
          >
            {t("top_cta_signup")}
          </Link>
          <Link
            href="/login"
            className="block rounded-full border border-border px-6 py-4 text-center text-sm"
          >
            {t("login")}
          </Link>
        </div>

        <p className="mt-10 text-center">
          <Link
            href="/admin-login"
            className="text-[11px] text-muted/70 underline-offset-4 hover:underline"
          >
            {t("top_adminlogin")}
          </Link>
        </p>
      </main>
    );
  }

  // ログイン後: マッチ状況を計算
  const email = (user.email ?? "").toLowerCase();
  const supabase = createAdminClient();
  const [{ data: mineData }, { data: activeData }] = await Promise.all([
    supabase
      .from("inquiries")
      .select("id, kind, manufacturer, model, status")
      .eq("auth_user_id", user.id)
      .in("status", STATUS_ACTIVE),
    supabase.from("inquiries").select("kind, manufacturer, model").in("status", STATUS_ACTIVE),
  ]);
  void email;
  const present = new Set<string>();
  for (const r of activeData ?? []) present.add(`${r.kind}:${key(r.manufacturer, r.model)}`);
  const matchedCount = (mineData ?? []).filter((r) => {
    const opposite = r.kind === "BUY" ? "SELL" : "BUY";
    return present.has(`${opposite}:${key(r.manufacturer, r.model)}`);
  }).length;

  const ENTRIES = [
    {
      href: "/sell",
      emoji: "🚗",
      title: t("top_sell_title"),
      body: t("top_sell_body"),
      accent: "border-accent/40 bg-accent/[0.06] hover:border-accent",
    },
    {
      href: "/buy",
      emoji: "🔎",
      title: t("top_buy_title"),
      body: t("top_buy_body"),
      accent: "border-sky-400/40 bg-sky-400/[0.06] hover:border-sky-400",
    },
    {
      href: "/mypage",
      emoji: "👤",
      title: t("top_mypage_title"),
      body: t("top_mypage_body"),
      accent: "border-border bg-card hover:border-primary",
    },
  ];

  return (
    <main className="mx-auto max-w-xl px-6 pt-10 pb-16">
      <div className="mb-4 flex justify-end">
        <LangToggle lang={lang} />
      </div>
      <header className="text-center">
        <div className="flex justify-center">
          <Wordmark />
        </div>
      </header>

      {matchedCount > 0 && (
        <Link
          href="/mypage"
          className="mt-8 flex items-center justify-between rounded-2xl border border-accent/50 bg-accent/10 p-4 hover:border-accent"
        >
          <span>
            <span className="block text-sm font-semibold text-accent">{t("top_match_title")}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {t("top_match_body")}（{matchedCount}）
            </span>
          </span>
          <span className="text-accent">›</span>
        </Link>
      )}

      <section className={`${matchedCount > 0 ? "mt-4" : "mt-9"} space-y-3`}>
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={`flex items-center gap-4 rounded-2xl border p-5 transition-colors ${e.accent}`}
          >
            <span className="text-3xl">{e.emoji}</span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold">{e.title}</span>
              <span className="mt-0.5 block text-sm text-muted">{e.body}</span>
            </span>
            <span className="ml-auto text-xl text-muted">›</span>
          </Link>
        ))}
      </section>

      <p className="mt-12 text-center text-xs text-muted">{t("top_footer")}</p>
    </main>
  );
}
