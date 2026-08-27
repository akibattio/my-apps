"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { STATUS_LABEL } from "./constants";

const BUCKET = "inquiry-photos"; // 非公開バケット
const MAX_PHOTOS = 10;

export type InquiryState = { error?: string };

// 依頼を1件登録する（内部・管理者のみ）。写真は非公開バケットへ、パスのみ保存。
export async function createInquiry(
  _prev: InquiryState,
  formData: FormData
): Promise<InquiryState> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const contactMethod = String(formData.get("contactMethod") ?? "").trim();
  const vehicleText = String(formData.get("vehicleText") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const source = String(formData.get("source") ?? "MANUAL").trim() || "MANUAL";

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!name && !contact && !message && photos.length === 0) {
    return { error: "顧客名・連絡先・内容・写真のいずれかは入力してください。" };
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
