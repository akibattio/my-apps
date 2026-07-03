"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";

const BUCKET = "vehicle-images";
const MAX_PHOTOS = 10;

const TYPE_LABEL: Record<string, string> = {
  MAINTENANCE: "整備",
  REPAIR: "修理",
  TRAVEL: "旅",
  EVENT: "イベント",
  OTHER: "その他",
};

export type AddHistoryState = { error?: string };

// 出来事(History)を追加する。ログイン必須・本人が所有する車のみ。
export async function addHistory(
  _prev: AddHistoryState,
  formData: FormData
): Promise<AddHistoryState> {
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const typeRaw = String(formData.get("historyType") ?? "OTHER");
  const historyType = TYPE_LABEL[typeRaw] ? typeRaw : "OTHER";
  const memo = String(formData.get("memo") ?? "").trim();
  const eventDate =
    String(formData.get("eventDate") ?? "").trim() ||
    new Date().toISOString().slice(0, 10);

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!memo && photos.length === 0) {
    return { error: "メモか写真のどちらかを入れてください。" };
  }
  if (photos.length > MAX_PHOTOS) {
    return { error: `写真は最大${MAX_PHOTOS}枚までです。` };
  }

  const admin = createAdminClient();

  // 所有権チェック（本人の車か）
  const { data: vehicle } = await admin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("current_owner_id", owner.ownerId)
    .maybeSingle();
  if (!vehicle) {
    return { error: "この車を編集する権限がありません。" };
  }

  const { data: history } = await admin
    .from("histories")
    .insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      history_type: historyType,
      title: TYPE_LABEL[historyType],
      description: memo || null,
      event_date: eventDate,
      source: "OWNER",
      visibility: "PUBLIC",
    })
    .select("id")
    .single();

  for (let i = 0; i < photos.length; i++) {
    const file = photos[i];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `vehicles/${vehicleId}/history/${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) continue;
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    await admin.from("images").insert({
      vehicle_id: vehicleId,
      history_id: history?.id ?? null,
      image_url: pub.publicUrl,
    });
  }

  redirect(`/garage/${vehicleId}`);
}
