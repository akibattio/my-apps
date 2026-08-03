"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

// アプリらしい下タブバー。ログイン後の主要画面で表示する。
// 公開共有ページ(パスポート)やログイン・完了画面など「アプリの外」では隠す。
const HIDE_PREFIXES = ["/login", "/thank-you", "/passport", "/auth"];

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
};

const stroke = (active: boolean) => (active ? "var(--accent)" : "currentColor");

const TABS: Tab[] = [
  {
    href: "/",
    label: "ホーム",
    match: (p) => p === "/",
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 10.5 12 3l9 7.5M5 9v11h14V9"
          stroke={stroke(a)}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/register",
    label: "登録",
    match: (p) => p.startsWith("/register"),
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke={stroke(a)} strokeWidth="1.7" />
        <path
          d="M12 8v8M8 12h8"
          stroke={stroke(a)}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/garage",
    label: "ガレージ",
    match: (p) => p.startsWith("/garage"),
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10 12 4l8 6v9H4v-9Z"
          stroke={stroke(a)}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M8 19v-5h8v5" stroke={stroke(a)} strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "マイページ",
    match: (p) => p.startsWith("/account"),
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.4" stroke={stroke(a)} strokeWidth="1.7" />
        <path
          d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
          stroke={stroke(a)}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname() || "/";
  const hidden = HIDE_PREFIXES.some((p) => pathname.startsWith(p));

  // タブバー表示中は本文の下部に余白を作り、固定バーで隠れないようにする。
  useEffect(() => {
    document.body.classList.toggle("with-tabbar", !hidden);
    return () => document.body.classList.remove("with-tabbar");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav className="tabbar" aria-label="メインメニュー">
      <div className="mx-auto flex max-w-xl items-stretch justify-around">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              {t.icon(active)}
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
