import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabBar from "./TabBar";

export const metadata: Metadata = {
  title: "ARIOS — 一台ごとの歴史を100年残す信頼インフラ",
  description:
    "車の売買サイトではなく、一台の乗り物の人生を一本の時間軸で記録する Vehicle Timeline。History is never deleted.",
  manifest: "/manifest.webmanifest",
  applicationName: "ARIOS",
  appleWebApp: {
    capable: true,
    title: "ARIOS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Mobile First: 主要機能はスマホで完結させる前提のビューポート設定。
// viewportFit: "cover" でノッチ端末のセーフエリア（env(safe-area-inset-*)）を有効化。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
