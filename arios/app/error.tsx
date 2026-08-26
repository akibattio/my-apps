"use client";

// ページ内でエラーが起きたときのやさしいフォールバック（真っ黒なクラッシュ画面を防ぐ）。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-xs tracking-[0.4em] text-accent">ARIOS GARAGE</p>
      <h1 className="text-lg font-semibold">
        一時的なエラーが発生しました
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        通信が不安定な可能性があります。
        <br />
        少し時間をおいて、もう一度お試しください。
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-8 py-3 font-semibold text-black"
      >
        再読み込み
      </button>
      {error?.digest && (
        <p className="text-[10px] text-neutral-600">エラーID: {error.digest}</p>
      )}
    </main>
  );
}
