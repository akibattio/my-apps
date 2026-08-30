"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin, ensureOwner } from "@/lib/auth";
import { STATUS_LABEL } from "./constants";

const BUCKET = "inquiry-photos"; // 非公開バケット
const MAX_PHOTOS = 30;
const PARTY_TYPES = ["OWNER", "BROKER", "DEALER"];

export type InquiryState = { error?: string };

// 依頼を1件登録する（内部・管理者のみ）。写真は非公開バケットへ、パスのみ保存。
export async function createInquiry(
  _prev: InquiryState,
  formData: FormData
): Promise<InquiryState> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const vin = String(formData.get("vin") ?? "").trim();
  const partyRaw = String(formData.get("partyType") ?? "").trim().toUpperCase();
  const partyType = PARTY_TYPES.includes(partyRaw) ? partyRaw : "OWNER";
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const contactMethod = String(formData.get("contactMethod") ?? "").trim();
  const vehicleText = String(formData.get("vehicleText") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const source = String(formData.get("source") ?? "MANUAL").trim() || "MANUAL";

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  // 必須: 車体番号
  if (!vin) {
    return { error: "車体番号（必須）を入力してください。" };
  }
  if (photos.length > MAX_PHOTOS) {
    return { error: `写真は最大${MAX_PHOTOS}枚までです。` };
  }

  const supabase = createAdminClient();
  let inquiryId: string;

  try {
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        vin,
        party_type: partyType,
        name: name || null,
        contact: contact || null,
        contact_method: contactMethod || null,
        vehicle_text: vehicleText || null,
        message: message || null,
        source,
        status: "NEW",
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[inquiry] insert failed:", error);
      return { error: "依頼の登録に失敗しました。時間をおいて試してください。" };
    }
    inquiryId = data.id as string;

    const paths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `inquiries/${inquiryId}/${String(i).padStart(2, "0")}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        console.error("[inquiry] upload failed:", upErr);
        continue;
      }
      paths.push(path);
    }
    if (paths.length > 0) {
      await supabase.from("inquiries").update({ photo_urls: paths }).eq("id", inquiryId);
    }
  } catch (e) {
    console.error("[inquiry] unexpected:", e);
    return {
      error: "登録に失敗しました。通信環境を確認して、もう一度お試しください。",
    };
  }

  redirect(`/admin/inquiries/${inquiryId}`);
}

// ステータス更新（新着 → 対応中 → 完了 など）。
export async function updateInquiryStatus(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUS_LABEL[status]) redirect(`/admin/inquiries/${id || ""}`);

  const supabase = createAdminClient();
  await supabase
    .from("inquiries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  redirect(`/admin/inquiries/${id}`);
}

// 次アクション日・フォローアップメモを保存（管理者のみ）。
export async function saveFollowup(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/inquiries");

  const nextRaw = String(formData.get("nextActionDate") ?? "").trim();
  const next_action_date = /^\d{4}-\d{2}-\d{2}$/.test(nextRaw) ? nextRaw : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = createAdminClient();
  await supabase
    .from("inquiries")
    .update({ next_action_date, note, updated_at: new Date().toISOString() })
    .eq("id", id);

  redirect(`/admin/inquiries/${id}`);
}

// 「今、連絡した」を記録（最終接触を更新し、新規なら連絡済へ）。
export async function markContacted(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/inquiries");

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data: cur } = await supabase
    .from("inquiries")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  const patch: Record<string, unknown> = { last_contact_at: now, updated_at: now };
  if (cur?.status === "NEW") patch.status = "CONTACTED";
  await supabase.from("inquiries").update(patch).eq("id", id);

  redirect(`/admin/inquiries/${id}`);
}

// 依頼を「車両」として登録し、依頼と紐付ける。
// 依頼の写真(非公開)を車両画像(公開)へコピーし、最初の履歴に依頼内容を残す。
export async function linkInquiryToVehicle(formData: FormData): Promise<void> {
  const adminUser = await getCurrentAdmin();
  if (!adminUser) redirect("/");

  const inquiryId = String(formData.get("id") ?? "");
  if (!inquiryId) redirect("/admin/inquiries");

  const supabase = createAdminClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("id, message, vehicle_text, photo_urls, vehicle_id, vin")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inq) redirect("/admin/inquiries");
  if (inq.vehicle_id) redirect(`/garage/${inq.vehicle_id}`); // 既に紐付け済み

  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  const { data: vehicle, error: vErr } = await supabase
    .from("vehicles")
    .insert({
      manufacturer: null,
      model: inq.vehicle_text || null, // 暫定: 車について をモデル欄に。後で編集可
      vin: inq.vin || null, // 車体番号を引き継ぐ
      status: "REGISTERED",
      current_owner_id: owner.ownerId,
    })
    .select("id")
    .single();
  if (vErr || !vehicle) {
    console.error("[link] vehicle insert failed:", vErr);
    redirect(`/admin/inquiries/${inquiryId}`);
  }
  const vehicleId = vehicle.id as string;

  await supabase.from("ownerships").insert({
    vehicle_id: vehicleId,
    owner_id: owner.ownerId,
    is_current: true,
    start_date: today,
    source: "FROM_INQUIRY",
  });

  const { data: history } = await supabase
    .from("histories")
    .insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      history_type: "OTHER",
      title: "依頼から登録",
      description: inq.message || null,
      event_date: today,
      source: "FROM_INQUIRY",
      visibility: "PUBLIC",
    })
    .select("id")
    .single();

  // 依頼の写真(非公開バケット)を車両画像(公開バケット)へコピー（ベストエフォート）
  const paths: string[] = inq.photo_urls ?? [];
  for (let i = 0; i < paths.length; i++) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("inquiry-photos")
        .download(paths[i]);
      if (dlErr || !blob) continue;
      const ext = (paths[i].split(".").pop() || "jpg").toLowerCase();
      const dest = `vehicles/${vehicleId}/${String(i).padStart(2, "0")}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("vehicle-images")
        .upload(dest, blob, { contentType: blob.type || "image/jpeg" });
      if (upErr) continue;
      const { data: pub } = supabase.storage.from("vehicle-images").getPublicUrl(dest);
      await supabase.from("images").insert({
        vehicle_id: vehicleId,
        history_id: history?.id ?? null,
        image_url: pub.publicUrl,
        image_type: i === 0 ? "EXTERIOR" : null,
      });
    } catch (e) {
      console.error("[link] photo copy failed:", e);
    }
  }

  await supabase
    .from("inquiries")
    .update({ vehicle_id: vehicleId, updated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  redirect(`/garage/${vehicleId}`);
}
