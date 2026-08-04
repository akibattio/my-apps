import Link from "next/link";
import Wordmark from "./Wordmark";

// Top（公開・訪問者）。アプリのランディング。下タブバーから各機能へ。
const PRINCIPLES = [
  {
    title: "History is never deleted",
    body: "一度刻まれた歴史は消えません。オーナーが変わっても記録は残り続けます。",
  },
  {
    title: "Vehicle は永久",
    body: "車を主役に、一本の時間軸へ。所有・整備・修理・旅——すべてが積み重なります。",
  },
  {
    title: "写真から1分で登録",
    body: "写真を撮る → AIが下書き → 確認 → 保存。難しい入力はいりません。",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-6 pt-14">
      <header className="text-center">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <p className="mt-4 pl-[0.5em] text-[11px] tracking-[0.5em] text-accent">
          LIFE LINE
        </p>
        <h1 className="mt-7 text-3xl leading-snug font-semibold">
          一台ごとの歴史を、
          <br />
          100年残す。
        </h1>
        <p className="mt-5 text-left leading-relaxed text-muted">
          ARIOS
          は車の売買サイトではありません。一台の車の人生を一本の時間軸で記録する
          Vehicle Timeline
          です。歴史が育った結果として、売買が自然に生まれます。
        </p>
      </header>

      <Link
        href="/register"
        className="mt-8 block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black shadow-lg shadow-primary/20"
      >
        愛車を登録する
      </Link>
      <Link
        href="/garage"
        className="mt-3 block text-center text-sm text-muted underline-offset-4 hover:underline"
      >
        すでにアカウントをお持ちの方は マイガレージへ
      </Link>

      <section className="mt-12 space-y-3">
        {PRINCIPLES.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-sm font-medium tracking-wide">{p.title}</h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        History is never deleted.
      </p>
    </main>
  );
}
