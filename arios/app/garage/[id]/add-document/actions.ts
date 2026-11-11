"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";

const BUCKET = "vehicle-documents"; // 非公開バケット
const MAX_FILES = 10;

const TYPE_LABEL: Record<string, string> = {
  REGISTRATION: "車検証",
  SERVICE_RECORD: "整備記録",
  INVOICE: "請求書",
  CONTRACT: "契約書",
  OTHER: "その他",
};

export type AddDocumentState = { error?: string };

// 書類をアップロードする。ログイン必須・本人が所有する車のみ。
// 書類は非公開バケットへ。個人情報を含むため file_url にはパスのみ保存し公開しない。
export async function addDocument(
  _prev: AddDocumentState,
  formData: FormData
): Promise<AddDocumentState> {
  const t = tr(await getLang());
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const typeRaw = String(formData.get("documentType") ?? "OTHER");
  const documentType = TYPE_LABEL[typeRaw] ? typeRaw : "OTHER";

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: t("ad_err_none") };
  }
  if (files.length > MAX_FILES) {
    return { error: fill(t("ad_too_many"), { n: MAX_FILES }) };
  }

  const admin = createAdminClient();

  // 所有権チェック
  const { data: vehicle } = await admin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("current_owner_id", owner.ownerId)
    .maybeSingle();
  if (!vehicle) {
    return { error: t("ah_err_perm") };
  }

  const today = new Date().toISOString().slice(0, 10);

  // 記録に「書類を追加」を1件残す（非公開。表示名は documents.document_type から日英で出す）
  const { data: history } = await admin
    .from("histories")
    .insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      history_type: "DOCUMENT",
      title: null,
      description: null,
      event_date: today,
      source: "OWNER",
      visibility: "PRIVATE",
    })
    .select("id")
    .single();

  let uploaded = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `vehicles/${vehicleId}/docs/${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) {
      console.error("[add-document] upload failed:", upErr);
      continue;
    }

    const { error: insErr } = await admin.from("documents").insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      history_id: history?.id ?? null,
      document_type: documentType,
      file_url: path, // 非公開: パスのみ保存（公開URLにしない）
      verified_status: "SELF_REPORTED",
    });
    if (insErr) {
      // DB登録に失敗したらアップ済みの孤立ファイルを消す（非公開バケット）
      console.error("[add-document] document insert failed:", insErr);
      await admin.storage.from(BUCKET).remove([path]);
      continue;
    }
    uploaded++;
  }

  if (uploaded === 0) {
    return { error: t("ad_err_failed") };
  }

  redirect(`/garage/${vehicleId}`);
}
