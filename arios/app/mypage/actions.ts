"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

const BUCKET = "inquiry-photos";
const MAX_PHOTOS = 20;

// 自分の出品に写真を追加する（あとから／マイページから）。本人のみ。
export async function addListingPhotos(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/mypage");

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("inquiries")
    .select("id, auth_user_id, photo_urls")
    .eq("id", id)
    .maybeSingle();
  // 本人確認: 認証ユーザーIDで判定（メール文字列では判定しない）
  if (!row || row.auth_user_id !== user.id) redirect("/mypage");

  const existing: string[] = row.photo_urls ?? [];
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) redirect(`/mypage/${id}/edit`);

  const room = MAX_PHOTOS - existing.length;
  const toUpload = photos.slice(0, Math.max(0, room));

  const added: string[] = [];
  for (let i = 0; i < toUpload.length; i++) {
    const file = toUpload[i];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `inquiries/${id}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (error) {
      console.error("[mypage-photo] upload failed:", error);
      continue;
    }
    added.push(path);
  }
  if (added.length > 0) {
    await supabase
      .from("inquiries")
      .update({ photo_urls: [...existing, ...added], updated_at: new Date().toISOString() })
      .eq("id", id);
  }
  redirect(`/mypage/${id}/edit`);
}

// 自分の出品の写真を1枚削除する。本人のみ。
export async function removeListingPhoto(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");

  const id = String(formData.get("id") ?? "").trim();
  const path = String(formData.get("path") ?? "").trim();
  if (!id || !path) redirect("/mypage");

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("inquiries")
    .select("id, auth_user_id, photo_urls")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.auth_user_id !== user.id) redirect("/mypage");

  const existing: string[] = row.photo_urls ?? [];
  if (!existing.includes(path)) redirect(`/mypage/${id}/edit`);

  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
  await supabase
    .from("inquiries")
    .update({ photo_urls: existing.filter((p) => p !== path), updated_at: new Date().toISOString() })
    .eq("id", id);
  redirect(`/mypage/${id}/edit`);
}

// 自分の依頼(売り/買い)を修正更新する。認証ユーザーID一致の行のみ更新可。
export async function updateMyListing(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/mypage");

  const supabase = createAdminClient();
  // 本人確認: 認証ユーザーIDで判定（メール文字列では判定しない）
  const { data: row } = await supabase
    .from("inquiries")
    .select("id, auth_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.auth_user_id !== user.id) redirect("/mypage");

  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!manufacturer || !model) redirect(`/mypage/${id}/edit`);
  const priceRaw = String(formData.get("price") ?? "").replace(/[,\s¥円]/g, "").trim();
  const price = priceRaw && /^\d+$/.test(priceRaw) ? Number(priceRaw) : null;
  const message = String(formData.get("message") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;

  await supabase
    .from("inquiries")
    .update({ manufacturer, model, price, message, contact, name, updated_at: new Date().toISOString() })
    .eq("id", id);

  redirect("/mypage");
}
