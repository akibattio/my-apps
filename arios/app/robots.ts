import type { MetadataRoute } from "next";

// 開発中の限定公開: すべてのクローラを拒否する。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
