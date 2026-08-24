import Link from "next/link";
import Wordmark from "../Wordmark";

export const metadata = {
  title: "ARIOS GARAGE を試す — ご案内",
  description:
    "写真を撮るだけで、その車の記録が残る。ログイン不要で「登録 → 公開パスポート」を試せます。",
};

// 依頼者に見せるための公開オンボーディングページ（ログイン不要・共有可能）。
const STEPS = [
  {
    n: "1",
    title: "「愛車を登録する」から写真を選ぶ",
    body: "最大10枚。ナンバーが写っていなくても大丈夫です。ログインは不要です。",
  },
  {
    n: "2",
    title: "AIが車種を下書き → 確認して保存",
    body: "写真からメーカー・モデル・年式をAIが推定。断定せず“確信度と根拠”を添えるので、確認して直すだけ。",
  },
  {
    n: "3",
    title: "公開パスポートが完成",
    body: "その車の履歴（タイムライン）と、証拠にもとづく信頼スコアが1ページに。URLで誰にでも見せられます。",
  },
];

const NOW = [
  "写真からの公開登録（ログイン不要）",
  "AIによる車種の下書き",
  "公開パスポート＋信頼スコア",
  "マイガレージ（履歴・書類・修正）",
  "管理者ダッシュボード",
];
const SOON = [
  "ご自身のメールでのログイン（配信ドメイン認証を準備中）",
  "車の所有者の引き継ぎ（乗り換え時）",
  "デザイン・細部の作り込み",
];

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="text-center">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <p className="mt-4 pl-[0.5em] text-[11px] tracking-[0.5em] text-accent">
          LIFE LINE
        </p>
        <h1 className="mt-7 text-2xl font-semibold leading-snug text-balance">
          写真を撮るだけで、
          <br />
          その車の記録が残る。
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-left leading-relaxed text-muted">
          一台ごとの歴史を100年残す、車のためのタイムライン。売買サイトではなく、車の人生そのものを記録します。
        </p>
      </header>

      <Link
        href="/register"
        className="mt-8 block rounded-full bg-primary px-6 py-4 text-center font-semibold text-black shadow-lg shadow-primary/20"
      >
        写真で登録してみる
      </Link>
      <p className="mt-3 text-center text-xs text-muted">
        ログイン不要。1分ほどで公開パスポートができます。
      </p>

      <section className="mt-12">
        <div className="mb-4 flex items-center gap-3 text-xs tracking-[0.28em] text-accent">
          <span className="h-px flex-1 bg-border" />
          試してみてください
          <span className="h-px flex-1 bg-border" />
        </div>
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="flex gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{s.title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted">
                  {s.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium text-accent">いま使えます</h2>
          <ul className="space-y-2 text-sm">
            {NOW.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="flex-none text-xs text-accent">◆</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium text-muted">調整中</h2>
          <ul className="space-y-2 text-sm text-muted">
            {SOON.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="flex-none text-xs">◇</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-8 rounded-xl border border-border border-l-[3px] border-l-accent bg-accent/5 p-4 text-sm leading-relaxed text-foreground/90">
        <b>まずはログイン不要の「登録 → 公開パスポート」で核心をお試しください。</b>
        ご自身のガレージにログインして続きを記録する機能も動いています。
      </div>

      <footer className="mt-10 text-center text-xs text-muted">
        株式会社ソフコム ／ ARIOS GARAGE（開発中デモ）
      </footer>
    </main>
  );
}
