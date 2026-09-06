"use client";

import { useRouter } from "next/navigation";

// テーブルの行(<tr>)全体をクリックできるようにする小さな部品。
// 行内の <a>/<button> をクリックした時は行遷移させない（個別リンク優先）。
export default function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("a,button")) return;
        router.push(href);
      }}
      className={`cursor-pointer ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}
