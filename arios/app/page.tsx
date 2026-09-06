import Link from "next/link";
import Wordmark from "./Wordmark";
import { getCurrentUser } from "@/lib/auth";

// Top（公開・訪問者）。3つの入口: 売りたい / 買いたい / マイページ。
export const dynamic = "force-dynamic";

const ENTRIES = [
  {
    href: "/sell",
    emoji: "🚗",
    title: "車を売りたい",
    body: "お車の情報を登録。ARIOSが買い手をお探しします。",
    accent: "border-accent/40 bg-accent/[0.06] hover:border-accent",
  },
  {
    href: "/buy",
    emoji: "🔎",
    title: "車を買いたい",
    body: "お探しの車を登録。条件に合う一台をお探しします。",
    accent: "border-sky-400/40 bg-sky-400/[0.06] hover:border-sky-400",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  const myHref = user ? "/mypage" : "/login";

  return (
    <main className="mx-auto max-w-xl px-6 pt-14 pb-16">
      <header className="text-center">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <h1 className="mt-8 text-3xl leading-snug font-semibold">
          売る人と買う人を、
          <br />
          ARIOSがつなぐ。
        </h1>
        <p className="mt-5 leading-relaxed text-muted">
          まずは「売りたい」か「買いたい」から。マイページに登録すると、
          やり取りの状況やマッチのお知らせをまとめて確認できます。
        </p>
      </header>

      <section className="mt-9 space-y-3">
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

        {/* マイページ（登録・ログイン） */}
        <Link
          href={myHref}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
        >
          <span className="text-3xl">👤</span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold">
              マイページ{user ? "" : "（登録・ログイン）"}
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {user
                ? "自分の売りたい・買いたい、マッチの状況を確認"
                : "登録すると状況をまとめて確認できます"}
            </span>
          </span>
          <span className="ml-auto text-xl text-muted">›</span>
        </Link>
      </section>

      <p className="mt-12 text-center text-xs text-muted">
        ARIOS — 一台ごとの人生を、つなぐ。
      </p>
    </main>
  );
}
