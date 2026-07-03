// Supabase Storage に車両写真用の公開バケットを作成する（冪等）。
// 使い方: node --env-file=.env scripts/setup-storage.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("環境変数が未設定です（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）。");
  process.exit(1);
}

const BUCKET = "vehicle-images";
const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("バケット一覧の取得に失敗:", listErr.message);
  process.exit(1);
}

if (buckets.some((b) => b.name === BUCKET)) {
  console.log(`バケット "${BUCKET}" は既に存在します。OK。`);
  process.exit(0);
}

const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: "15MB",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
});

if (createErr) {
  console.error(`バケット作成に失敗:`, createErr.message);
  process.exit(1);
}
console.log(`バケット "${BUCKET}"（公開）を作成しました。`);
