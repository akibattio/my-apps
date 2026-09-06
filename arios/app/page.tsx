import Link from "next/link";
import Wordmark from "./Wordmark";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE } from "@/app/admin/inquiries/constants";

// Top（公開）。未ログイン=会員登録/ログイン。ログイン後=マッチ通知＋売りたい/買いたい/マイページ。
export const dynamic = "force-dynamic";

const key = (mk: string | null, md: string | null) =>
  (mk ?? "").trim().toLowerCase() + "||" + (md ?? "").trim().toLowerCase();

const ENTRIES = [
  {
    href: "/sell",
    emoji: "🚗",
    title: "車を売りたい",
    body: "お車の情報とご連絡先を登録。ARIOSが買い手をお探しします。",
    accent: "border-accent/40 bg-accent/[0.06] hover:border-accent",
  },
  {
    href: "/buy",
    emoji: "🔎",
    title: "車を買いたい",
    body: "お探しの車とご連絡先を登録。条件に合う一台をお探しします。",
    accent: "border-sky-400/40 bg-sky-400/[0.06] hover:border-sky-400",
  },
  {
    href: "/mypage",
    emoji: "👤",
    title: "マイページ",
    body: "登録・リクエストの状況、マッチング、会員情報を確認",
    accent: "border-border bg-card hover:border-primary",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  // 未ログイン: 会員登録 / ログイン
  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
        <header className="text-center">
          <div className="flex justify-center">
            <Wordmark />
          </div>
          <h1 className="mt-8 text-2xl leading-snug font-semibold">
            売る人と買う人を、
            <br />
            ARIOSがつなぐ。
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            ご利用には会員登録が必要です。登録すると「売りたい・買いたい」の登録や、
            マッチングの確認ができます。
          </p>
        </header>

        <div className="mt-8 space-y-3">
          <Link
            href="/signup"
            className="block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black"
          >
            会員登録する
          </Link>
          <Link
            href="/login"
            className="block rounded-full border border-border px-6 py-4 text-center text-sm"
          >
            ログイン
          </Link>
        </div>

        <p className="mt-10 text-center">
          <Link
            href="/admin-login"
            className="text-[11px] text-muted/70 underline-offset-4 hover:underline"
          >
            管理者ログイン
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
      .eq("email", email)
      .in("status", STATUS_ACTIVE),
    supabase.from("inquiries").select("kind, manufacturer, model").in("status", STATUS_ACTIVE),
  ]);
  const present = new Set<string>();
  for (const r of activeData ?? []) present.add(`${r.kind}:${key(r.manufacturer, r.model)}`);
  const matchedCount = (mineData ?? []).filter((r) => {
    const opposite = r.kind === "BUY" ? "SELL" : "BUY";
    return present.has(`${opposite}:${key(r.manufacturer, r.model)}`);
  }).length;

  return (
    <main className="mx-auto max-w-xl px-6 pt-14 pb-16">
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
            <span className="block text-sm font-semibold text-accent">🔔 マッチングがあります</span>
            <span className="mt-0.5 block text-xs text-muted">
              条件の合う相手が見つかっています（{matchedCount}件）。マイページで確認
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

      <p className="mt-12 text-center text-xs text-muted">
        ARIOS — 一台ごとの人生を、つなぐ。
      </p>
    </main>
  );
}
