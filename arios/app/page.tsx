import Link from "next/link";

// Top（公開・訪問者）。Phase 2 で Register への導線と実コンテンツを作り込む。
// ここは雛形として、思想（Vehicle Timeline 中心）と入口だけを置く。
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-between px-6 py-14">
      <header>
        <p className="text-sm tracking-[0.3em] text-accent">ARIOS</p>
        <h1 className="mt-6 text-3xl leading-snug font-semibold">
          一台ごとの歴史を、
          <br />
          100年残す。
        </h1>
        <p className="mt-5 leading-relaxed text-muted">
          ARIOS は車の売買サイトではありません。
          一台の乗り物の人生を一本の時間軸で記録する Vehicle Timeline
          です。所有・整備・修理・レース・旅・書類・写真——すべてがここに積み重なり、
          歴史が育った結果として売買が自然に生まれます。
        </p>
      </header>

      <section className="my-12">
        <ul className="space-y-3 text-sm text-muted">
          <li>・History is never deleted（歴史は消さない）</li>
          <li>・Vehicle は永久。Owner が変わっても Timeline は不変</li>
          <li>・写真 → AI解析 → 確認 → 保存。登録は1分以内</li>
        </ul>
      </section>

      <footer className="space-y-4">
        <Link
          href="/register"
          className="block rounded-full bg-accent px-6 py-4 text-center font-medium text-black"
        >
          愛車を登録する
        </Link>
        <p className="text-center text-xs text-muted">
          ※ 登録フロー（Register / Photo Upload / AI / Timeline）は Phase 2 で実装
        </p>
      </footer>
    </main>
  );
}
