import type { Metadata, Viewport } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import TabBar from "./TabBar";

// ロゴ名（LIFE LINE GARAGE）用のブランドフォント。太字・斜体でスポーティに。
const brandFont = Kanit({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LIFE LINE GARAGE — 一台ごとの歴史を100年残す",
  description:
    "写真を撮るだけで、その車の消えない履歴書ができる。一台の車の人生を一本の時間軸で記録する Vehicle Timeline。History is never deleted.",
  manifest: "/manifest.webmanifest",
  applicationName: "LIFE LINE GARAGE",
  // 開発中の限定公開のため、検索エンジン・クローラには載せない
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "LIFE LINE GARAGE",
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
    <html lang="ja" className={brandFont.variable}>
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
