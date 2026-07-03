import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARIOS — 一台ごとの歴史を100年残す信頼インフラ",
  description:
    "車の売買サイトではなく、一台の乗り物の人生を一本の時間軸で記録する Vehicle Timeline。History is never deleted.",
};

// Mobile First: 主要機能はスマホで完結させる前提のビューポート設定。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
