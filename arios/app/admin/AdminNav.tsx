"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "サマリー", exact: true },
  { href: "/admin/buyers", label: "買いたい" },
  { href: "/admin/sellers", label: "売りたい" },
  { href: "/admin/matching", label: "マッチング" },
  { href: "/account", label: "マイページ" },
];

// 折り返さない横スクロールのタブナビ。現在地を下線でハイライト。
export default function AdminNav() {
  const pathname = usePathname() || "";
  return (
    <nav className="-mx-5 mb-6 overflow-x-auto border-b border-border px-5">
      <div className="flex gap-1 whitespace-nowrap">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
                active
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
