"use client";

import type { Lang } from "@/lib/i18n";

// 日本語／英語の手動切替。Cookie に保存して再読込（タブ名・下部メニューまで即時に切り替える）。
export default function LangToggle({ lang }: { lang: Lang }) {
  function set(l: Lang) {
    if (l === lang) return;
    document.cookie = `lang=${l};path=/;max-age=31536000;samesite=lax`;
    window.location.reload();
  }
  const base = "px-2.5 py-1 text-xs rounded-full transition-colors";
  const on = "bg-accent/15 text-accent font-medium";
  const off = "text-muted hover:text-foreground";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1 py-0.5">
      <button type="button" onClick={() => set("ja")} className={`${base} ${lang === "ja" ? on : off}`}>
        日本語
      </button>
      <button type="button" onClick={() => set("en")} className={`${base} ${lang === "en" ? on : off}`}>
        EN
      </button>
    </div>
  );
}
