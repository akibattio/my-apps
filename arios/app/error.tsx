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
    staleTitle: "サイトが更新されました",
    staleBody1: "画面を開いている間にサイトが新しくなったため、送信できませんでした。",
    staleBody2: "再読み込みして、もう一度送信してください（入力内容は消えます）。",
  },
  en: {
    title: "A temporary error occurred",
    body1: "We couldn't load the data.",
    body2: "Please wait a moment and try again.",
    retry: "Reload",
    id: "Error ID",
    staleTitle: "The site was updated",
    staleBody1: "The site was updated while this page was open, so it couldn't be sent.",
    staleBody2: "Please reload and send it again (your input will be cleared).",
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
  // 画面を開いたあとにサイトが更新されると、古い画面からの送信（サーバーアクション）が見つからずに失敗する。
  // そのときは「更新されたので再読み込みを」と案内する（再読み込みすれば送れる）。
  const stale = /Server Action|failed-to-find-server-action/i.test(error?.message ?? "");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-xs tracking-[0.4em] text-accent">LIFE LINE GARAGE</p>
      <h1 className="text-lg font-semibold">{stale ? t.staleTitle : t.title}</h1>
      <p className="text-sm leading-relaxed text-muted">
        {stale ? t.staleBody1 : t.body1}
        <br />
        {stale ? t.staleBody2 : t.body2}
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
