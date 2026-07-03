import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 画像は Supabase Storage を主に使う。ドメインは接続確定後に追加する。
  // 例: images: { remotePatterns: [{ protocol: "https", hostname: "<ref>.supabase.co" }] }
  reactStrictMode: true,
};

export default nextConfig;
