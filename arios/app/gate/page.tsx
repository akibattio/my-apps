import Wordmark from "../Wordmark";

export const metadata = { title: "ARIOS GARAGE" };

// 合言葉ゲート。関係者向けの限定公開。正しい合言葉で Cookie を得て中に入れる。
export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";
  const error = sp.error;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <header className="mb-8 flex flex-col items-center text-center">
        <Wordmark />
        <p className="mt-4 pl-[0.5em] text-[11px] tracking-[0.5em] text-accent">
          LIFE LINE
        </p>
      </header>

      <h1 className="mb-1 text-center text-lg font-semibold">合言葉を入力</h1>
      <p className="mb-6 text-center text-sm text-muted">
        関係者向けの限定公開です。
      </p>

      <form method="post" action="/api/gate" className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input
          name="code"
          type="password"
          required
          autoFocus
          autoComplete="off"
          placeholder="合言葉"
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-center tracking-widest text-foreground placeholder:text-neutral-500"
        />
        <button
          type="submit"
          className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
        >
          開く
        </button>
        {error && (
          <p className="text-center text-sm text-red-400">
            合言葉が違います。もう一度お試しください。
          </p>
        )}
      </form>
    </main>
  );
}
