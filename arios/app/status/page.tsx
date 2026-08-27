import Wordmark from "../Wordmark";

export const metadata = {
  title: "ARIOS GARAGE 開発進捗",
  description: "ARIOS GARAGE の開発進捗（内部運用フェーズ）",
};

// 依頼者に共有するための公開進捗ページ（合言葉なしで閲覧可・検索非掲載）。
type Item = { label: string; sub?: string; state: "done" | "wait" | "talk" | "todo" };

const GROUPS: { title: string; mini: string; items: Item[] }[] = [
  {
    title: "依頼・案件管理（内部）",
    mini: "4 / 4",
    items: [
      { label: "依頼インボックス", sub: "電話・LINE・来店の相談を記録＝忘れない", state: "done" },
      { label: "ステータス管理（新着→対応中→完了→保管）", state: "done" },
      { label: "依頼→車両の連携", sub: "依頼から車両登録・写真/内容を引き継ぎ", state: "done" },
      { label: "写真は非公開で保存（署名付きで表示）", state: "done" },
    ],
  },
  {
    title: "コア機能（車両の記録）",
    mini: "4 / 4",
    items: [
      { label: "写真からの登録＋AI車種下書き", state: "done" },
      { label: "タイムライン（履歴の積み重ね）", state: "done" },
      { label: "車両パスポート＋信頼スコア", state: "done" },
      { label: "履歴・書類の追加、登録内容の修正", state: "done" },
    ],
  },
  {
    title: "基盤・UI・管理",
    mini: "完了",
    items: [
      { label: "DB・ストレージ・認証・本番デプロイ", state: "done" },
      { label: "スマホアプリUI（PWA・下タブ・ロゴ・LIFE LINE）", state: "done" },
      { label: "管理者ダッシュボード・マイページ", state: "done" },
      { label: "メールログイン（マジックリンク）", state: "done" },
    ],
  },
  {
    title: "セキュリティ・費用対策",
    mini: "完了",
    items: [
      { label: "合言葉ゲート＋検索非掲載（noindex）", state: "done" },
      { label: "障害耐性・AIレート制限", state: "done" },
      { label: "外部レビュー（codex）指摘の重要点を修正", state: "done" },
      { label: "AI費用の月額上限（$50）", state: "done" },
    ],
  },
  {
    title: "これから",
    mini: "対応予定",
    items: [
      { label: "インフラをクライアント名義へ", sub: "まずAI(Anthropic)＝唯一の実費。他は無料枠", state: "wait" },
      { label: "依頼項目の追加（予算・納期・担当・次アクション等）", state: "talk" },
      { label: "LINE連携で依頼を自動取り込み", state: "todo" },
      { label: "一般公開に向けた本格対策（公開する場合）", state: "todo" },
    ],
  },
];

const ICON: Record<Item["state"], string> = { done: "✓", wait: "◆", talk: "◇", todo: "·" };
const ICON_COLOR: Record<Item["state"], string> = {
  done: "text-accent",
  wait: "text-primary",
  talk: "text-sky-300",
  todo: "text-neutral-600",
};
const CHIP: Record<Item["state"], { label: string; cls: string }> = {
  done: { label: "完了", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" },
  wait: { label: "要対応", cls: "text-black bg-primary" },
  talk: { label: "相談中", cls: "text-sky-300 border-sky-400/30 bg-sky-400/10" },
  todo: { label: "将来", cls: "text-muted border-border bg-white/5" },
};

export default function StatusPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pb-16 pt-12">
      <header className="flex flex-col items-center text-center">
        <Wordmark />
        <p className="mt-3 pl-[0.5em] text-[10px] tracking-[0.5em] text-accent">LIFE LINE</p>
        <h1 className="mt-5 text-2xl font-semibold">開発進捗</h1>
        <p className="mt-1 text-xs text-muted">更新: 2026-08-27 ／ 内部運用フェーズ</p>
      </header>

      <div className="mt-6 rounded-xl border border-sky-400/30 bg-sky-400/5 p-4 text-sm leading-relaxed text-sky-100/90">
        <b className="text-white">方針：</b>
        当面は一般公開せず、<b className="text-white">お店の内部ツール</b>
        として運用（取引・やり取りを忘れないため）。合言葉＋ログインの内側で使用します。
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">全体の進捗</span>
          <span className="text-2xl font-bold tabular-nums">92%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full border border-border bg-black">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-primary"
            style={{ width: "92%" }}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          コア機能・UI・依頼管理・公開対策まで完成し本番稼働中。残りはインフラのクライアント名義化と、運用しながらの項目調整。
        </p>
      </section>

      <div className="mt-6 space-y-3">
        {GROUPS.map((g) => (
          <section key={g.title} className="overflow-hidden rounded-2xl border border-border bg-card">
            <h2 className="flex items-center justify-between border-b border-border bg-white/[0.02] px-4 py-3 text-sm">
              <span>{g.title}</span>
              <span className="text-xs text-muted tabular-nums">{g.mini}</span>
            </h2>
            <ul>
              {g.items.map((it) => (
                <li
                  key={it.label}
                  className="flex items-center gap-3 border-t border-white/[0.03] px-4 py-2.5 first:border-t-0"
                >
                  <span className={`w-4 flex-none text-center text-sm ${ICON_COLOR[it.state]}`}>
                    {ICON[it.state]}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    {it.label}
                    {it.sub && <span className="mt-0.5 block text-xs text-muted">{it.sub}</span>}
                  </span>
                  <span
                    className={`flex-none whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] ${CHIP[it.state].cls}`}
                  >
                    {CHIP[it.state].label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-border border-l-[3px] border-l-primary bg-primary/5 p-4">
        <h3 className="mb-2 text-sm font-medium">次の一手</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground/90">
          <li>AI(Anthropic)をクライアント名義に切替（費用の付け替え・APIキー差替のみ）</li>
          <li>実際に使ってみて、依頼の項目・並び順を調整</li>
        </ol>
      </section>

      <footer className="mt-8 text-center text-xs text-muted">
        ARIOS GARAGE ／ 株式会社ソフコム ・ 開発中（内部運用）
      </footer>
    </main>
  );
}
