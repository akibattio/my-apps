"use client";

import { useEffect, useState } from "react";

// ページ内でエラーが起きたときのやさしいフォールバック（真っ黒なクラッシュ画面を防ぐ）。
// データの読み込みに失敗したときもここに来る（lib/db.ts の throwIfDbError）。
// 表示言語は Cookie（lang）に合わせる。
const TEXT = {
  ja: {
    title: "一時的なエラーが発生しました",
    body1: "データを読み込めませんでした。",
    body2: "少し時間をおいて、もう一度お試しください。",
    retry: "再読み込み",
    id: "エラーID",
  },
  en: {
    title: "A temporary error occurred",
    body1: "We couldn't load the data.",
    body2: "Please wait a moment and try again.",
    retry: "Reload",
    id: "Error ID",
  },
};

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [lang, setLang] = useState<"ja" | "en">("ja");
  useEffect(() => {
    if (/(?:^|;\s*)lang=en(?:;|$)/.test(document.cookie)) setLang("en");
  }, []);
  const t = TEXT[lang];

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-xs tracking-[0.4em] text-accent">LIFE LINE GARAGE</p>
      <h1 className="text-lg font-semibold">{t.title}</h1>
      <p className="text-sm leading-relaxed text-muted">
        {t.body1}
        <br />
        {t.body2}
      </p>
      {/* サーバー側の読み込み失敗は reset() だけでは再取得されないため、ページごと読み直す */}
      <button
        onClick={() => {
          reset();
          window.location.reload();
        }}
        className="rounded-full bg-primary px-8 py-3 font-semibold text-black"
      >
        {t.retry}
      </button>
      {error?.digest && (
        <p className="text-[10px] text-neutral-600">
          {t.id}: {error.digest}
        </p>
      )}
    </main>
  );
}
