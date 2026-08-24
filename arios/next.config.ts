import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 画像は Supabase Storage を主に使う。ドメインは接続確定後に追加する。
  // 例: images: { remotePatterns: [{ protocol: "https", hostname: "<ref>.supabase.co" }] }
  reactStrictMode: true,
  experimental: {
    // 写真アップロード（Server Action）の本文サイズ上限を引き上げる。
    // クライアント側で縮小もするが、余裕を持たせる。
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
