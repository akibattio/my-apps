"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { validateImageFile } from "@/lib/upload";
import { normalizeVin, isValidVin } from "@/app/listings/vin";
import { linkListingToVehicle } from "@/lib/vehicles";

const BUCKET = "inquiry-photos";
const MAX_PHOTOS = 20;
const PARTY_TYPES = ["OWNER", "BROKER", "DEALER"];

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
    // 実バイトで画像か検証（拡張子/申告MIMEは信用しない）。非画像・過大はスキップ。
    const v = await validateImageFile(file);
    if (!v.ok) {
      console.warn("[mypage-photo] rejected upload:", v.reason);
      continue;
    }
    const path = `inquiries/${id}/${Date.now()}-${i}.${v.ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: v.contentType });
    if (error) {
      console.error("[mypage-photo] upload failed:", error);
      continue;
    }
    added.push(path);
  }
  if (added.length > 0) {
    const { error: updErr } = await supabase
      .from("inquiries")
      .update({ photo_urls: [...existing, ...added], updated_at: new Date().toISOString() })
      .eq("id", id);
    // DB更新に失敗したらアップロード済みの孤立ファイルを消す。
    if (updErr) {
      console.error("[mypage-photo] photo_urls update failed, cleaning up:", updErr);
      await supabase.storage.from(BUCKET).remove(added).catch(() => {});
    }
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
    .select("id, kind, auth_user_id, vin, party_type, vehicle_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.auth_user_id !== user.id) redirect("/mypage");
  const back = (err: string) => redirect(`/mypage/${id}/edit?err=${err}`);

  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!manufacturer || !model) back("form_err_makermodel");
  const priceRaw = String(formData.get("price") ?? "").replace(/[,\s¥円]/g, "").trim();
  const price = priceRaw && /^\d+$/.test(priceRaw) ? Number(priceRaw) : null;
  const message = String(formData.get("message") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;

  // 売りたい: 区分・車体番号は必須。仲介・業者はオーナー本人からの依頼確認と本人名（非公開）が必須。
  let sellFields: Record<string, unknown> = {};
  if (row.kind === "SELL") {
    const partyRaw = String(formData.get("partyType") ?? "").trim().toUpperCase();
    const partyType = PARTY_TYPES.includes(partyRaw) ? partyRaw : null;
    const vin = normalizeVin(String(formData.get("vin") ?? ""));
    const isAgent = partyType === "BROKER" || partyType === "DEALER";
    const ownerConsent = String(formData.get("ownerConsent") ?? "") === "on";
    const ownerName = String(formData.get("ownerName") ?? "").trim().slice(0, 100);
    if (!partyType) back("sell_party_err");
    if (!isValidVin(vin)) back("sell_vin_err");
    if (isAgent && !ownerConsent) back("sell_consent_err");
    if (isAgent && !ownerName) back("sell_owner_name_err");
    sellFields = {
      party_type: partyType,
      vin,
      owner_consent: isAgent ? ownerConsent : false,
      owner_name: isAgent ? ownerName : null,
    };
  }

  const { error } = await supabase
    .from("inquiries")
    .update({
      manufacturer,
      model,
      price,
      message,
      contact,
      name,
      ...sellFields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[mypage] update failed:", error);
    back("my_save_err");
  }

  // 車体番号か区分が変わったら、車の記録につなぎ直す（前の記録の経緯は運営用に残る）。
  if (
    row.kind === "SELL" &&
    (!row.vehicle_id ||
      normalizeVin(row.vin ?? "") !== sellFields.vin ||
      row.party_type !== sellFields.party_type)
  ) {
    after(() =>
      linkListingToVehicle({
        id,
        vin: sellFields.vin as string,
        manufacturer,
        model,
        partyType: sellFields.party_type as string,
        authUserId: user.id,
        email: user.email ?? null,
      })
    );
  }

  redirect("/mypage");
}

// 自分の登録（売り/買い）を削除する。本人のみ。取引の記録がある登録は運営に残すため削除しない。
export async function deleteMyListing(formData: FormData): Promise<void> {
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
  if (!row || row.auth_user_id !== user.id) redirect("/mypage");

  const { count } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .or(`buyer_inquiry_id.eq.${row.id},seller_inquiry_id.eq.${row.id}`);
  if ((count ?? 0) > 0) redirect(`/mypage/${id}/edit?err=my_delete_blocked`);

  const { error } = await supabase.from("inquiries").delete().eq("id", row.id);
  if (error) {
    console.error("[mypage] delete failed:", error);
    redirect(`/mypage/${id}/edit?err=my_save_err`);
  }
  const paths: string[] = row.photo_urls ?? [];
  if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});

  redirect("/mypage?deleted=1");
}
