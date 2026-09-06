"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// お客様向けの固定フッターナビ（スマホ表示）。売りたい / 買いたい / マイページ。
// TOP はロゴで戻れるためタブには入れない。管理・認証画面では非表示。
const HIDE_PREFIXES = [
  "/admin",
  "/admin-login",
  "/login",
  "/signup",
  "/auth",
  "/gate",
  "/passport",
  "/register",
  "/garage",
  "/account",
  "/thank-you",
  "/welcome",
  "/status",
];

const stroke = (active: boolean) => (active ? "var(--accent)" : "currentColor");

const TABS = [
  {
    href: "/sell",
    label: "売りたい",
    match: (p: string) => p.startsWith("/sell"),
    icon: (a: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 13l1.5-4.5A2 2 0 0 1 7.4 7h9.2a2 2 0 0 1 1.9 1.5L20 13v5h-3v-2H7v2H4v-5Z"
          stroke={stroke(a)}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="15.5" r="1" fill={stroke(a)} />
        <circle cx="16.5" cy="15.5" r="1" fill={stroke(a)} />
      </svg>
    ),
  },
  {
    href: "/buy",
    label: "買いたい",
    match: (p: string) => p.startsWith("/buy"),
    icon: (a: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6" stroke={stroke(a)} strokeWidth="1.7" />
        <path d="m20 20-3.2-3.2" stroke={stroke(a)} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "マイページ",
    match: (p: string) => p.startsWith("/mypage"),
    icon: (a: boolean) => (
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
  const [mounted, setMounted] = useState(false);
  // トップ("/")は独自のカード導線があるので下タブは出さない。
  const hidden = pathname === "/" || HIDE_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("with-tabbar", mounted && !hidden);
    return () => document.body.classList.remove("with-tabbar");
  }, [mounted, hidden]);

  if (!mounted || hidden) return null;

  return (
    <nav className="tabbar md:hidden" aria-label="メインメニュー">
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
