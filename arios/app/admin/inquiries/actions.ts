"use server";

import { redirect } from "next/navigation";
import { linkListingToVehicle } from "@/lib/vehicles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { validateImageFile } from "@/lib/upload";
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
      // 実バイト(マジックナンバー)で画像か検証。拡張子/申告MIMEは信用しない。
      const v = await validateImageFile(file);
      if (!v.ok) {
        console.warn("[inquiry] rejected upload:", v.reason);
        continue;
      }
      const path = `inquiries/${inquiryId}/${String(i).padStart(2, "0")}-${Date.now()}.${v.ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: v.contentType });
      if (upErr) {
        console.error("[inquiry] upload failed:", upErr);
        continue;
      }
      paths.push(path);
    }
    if (paths.length > 0) {
      const { error: updErr } = await supabase
        .from("inquiries")
        .update({ photo_urls: paths })
        .eq("id", inquiryId);
      // DB更新に失敗したらアップロード済みの孤立ファイルを消す。
      if (updErr) {
        console.error("[inquiry] photo_urls update failed, cleaning up:", updErr);
        await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
      }
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

// 登録者情報（名前・会社名・連絡先・メール）を管理者が修正する。
export async function updateInquiryContact(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/inquiries");

  const name = String(formData.get("name") ?? "").trim() || null;
  const company = String(formData.get("company_name") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const contactMethod = String(formData.get("contactMethod") ?? "").trim() || null;
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      ? emailRaw
      : null
    : null;

  const supabase = createAdminClient();
  await supabase
    .from("inquiries")
    .update({
      name,
      company,
      contact,
      contact_method: contactMethod,
      email,
      updated_at: new Date().toISOString(),
    })
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

// 売りたい登録を、車体番号で車の記録につなぐ（自動でつながらなかった古い登録や、失敗したとき用）。
export async function linkInquiryToVehicle(formData: FormData): Promise<void> {
  const adminUser = await getCurrentAdmin();
  if (!adminUser) redirect("/");

  const inquiryId = String(formData.get("id") ?? "");
  if (!inquiryId) redirect("/admin/inquiries");

  const supabase = createAdminClient();
  const { data: inq } = await supabase
    .from("inquiries")
    .select("id, kind, vin, manufacturer, model, party_type, auth_user_id, email, vehicle_id")
    .eq("id", inquiryId)
    .maybeSingle();
  if (!inq) redirect("/admin/inquiries");
  if (inq.vehicle_id) redirect(`/admin/vehicles/${inq.vehicle_id}`); // 既につながっている

  const link = await linkListingToVehicle({
    id: inq.id,
    vin: inq.vin,
    manufacturer: inq.manufacturer,
    model: inq.model,
    partyType: inq.party_type,
    authUserId: inq.auth_user_id,
    email: inq.email,
  });
  if (!link) redirect(`/admin/inquiries/${inquiryId}?vehicle_err=1`);
  redirect(`/admin/vehicles/${link.vehicleId}`);
}
