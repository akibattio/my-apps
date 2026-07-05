// Supabase Storage のバケットを作成する（冪等）。
// - vehicle-images: 車両写真（公開）。パスポートに表示する。
// - vehicle-documents: 車検証・整備記録など（非公開）。個人情報を含むため公開しない。
// 使い方: node --env-file=.env scripts/setup-storage.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）。");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKETS = [
  {
    name: "vehicle-images",
    public: true,
    fileSizeLimit: "15MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  },
  {
    name: "vehicle-documents",
    public: false, // 個人情報を含むため非公開。閲覧は署名URLで（後日）
    fileSizeLimit: "25MB",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "application/pdf",
    ],
  },
];

const { data: existing, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("バケット一覧の取得に失敗:", listErr.message);
  process.exit(1);
}
const existingNames = new Set(existing.map((b) => b.name));

for (const b of BUCKETS) {
  if (existingNames.has(b.name)) {
    console.log(`バケット "${b.name}" は既に存在します。OK。`);
    continue;
  }
  const { error } = await supabase.storage.createBucket(b.name, {
    public: b.public,
    fileSizeLimit: b.fileSizeLimit,
    allowedMimeTypes: b.allowedMimeTypes,
  });
  if (error) {
    console.error(`バケット "${b.name}" 作成に失敗:`, error.message);
    process.exit(1);
  }
  console.log(`バケット "${b.name}"（${b.public ? "公開" : "非公開"}）を作成しました。`);
}
