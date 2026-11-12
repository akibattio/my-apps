import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 画像は Supabase Storage を主に使う。ドメインは接続確定後に追加する。
  // 例: images: { remotePatterns: [{ protocol: "https", hostname: "<ref>.supabase.co" }] }
  reactStrictMode: true,
  // 保護ヘッダー（全ページ）。CSP は今回は入れない（Turnstile など外部の読み込みの整理が要るため）。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // カメラ・マイク・位置情報はサイトから使わない（写真はファイル選択で受け取る）
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    // 写真・書類アップロード（Server Action）の本文サイズ上限。
    // 写真はブラウザ側で縮小するが、書類（PDF）は縮小せず 1件10MB・最大10件まで受け付けるため、
    // 16MB より下げると書類の登録が失敗する恐れがある（2026-11-12 点検で据え置きと判断）。
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
