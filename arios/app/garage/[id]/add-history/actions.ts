"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";
import { validateImageFile } from "@/lib/upload";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";
import { parseLinks } from "@/lib/garage";

const BUCKET = "vehicle-images";
const MAX_PHOTOS = 10; // AddHistoryForm と同じ値
const TYPES = ["MAINTENANCE", "REPAIR", "EVENT", "TRAVEL", "OTHER"];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export type AddHistoryState = { error?: string };

// 記録（整備・イベントなど）を追加する。ログイン必須・本人が持ち主の車のみ。最初は非公開。
export async function addHistory(_prev: AddHistoryState, formData: FormData): Promise<AddHistoryState> {
  const t = tr(await getLang());
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const typeRaw = String(formData.get("historyType") ?? "OTHER");
  const historyType = TYPES.includes(typeRaw) ? typeRaw : "OTHER";
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 4000);
  const dateRaw = String(formData.get("eventDate") ?? "").trim();
  const eventDate = isDate(dateRaw) ? dateRaw : new Date().toISOString().slice(0, 10);
  const dueRaw = String(formData.get("nextDueDate") ?? "").trim();
  const nextDueDate = isDate(dueRaw) ? dueRaw : null;
  const mileageRaw = String(formData.get("mileage") ?? "").replace(/[,\s]/g, "");
  const mileage = /^\d{1,9}$/.test(mileageRaw) ? Number(mileageRaw) : null;
  const isPublic = String(formData.get("public") ?? "") === "on";
  const { links, bad } = parseLinks(String(formData.get("links") ?? ""));
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (bad) return { error: t("ah_err_link") };
  if (!title && !memo && photos.length === 0 && links.length === 0) return { error: t("ah_err_empty") };
  if (photos.length > MAX_PHOTOS) return { error: fill(t("reg_err_photos"), { n: MAX_PHOTOS }) };

  const admin = createAdminClient();

  // 本人が持ち主の車か
  const { data: vehicle } = await admin
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("current_owner_id", owner.ownerId)
    .maybeSingle();
  if (!vehicle) return { error: t("ah_err_perm") };

  const { data: history, error: hErr } = await admin
    .from("histories")
    .insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      history_type: historyType,
      title: title || null,
      description: memo || null,
      event_date: eventDate,
      next_due_date: nextDueDate,
      mileage,
      links: links.length > 0 ? links : null,
      source: "OWNER",
      visibility: isPublic ? "PUBLIC" : "PRIVATE",
    })
    .select("id")
    .single();
  if (hErr || !history) {
    console.error("[add-history] history insert failed:", hErr);
    return { error: t("ah_err_failed") };
  }

  // 走行距離が入っていれば車の記録にも反映（増えたときだけ）
  if (mileage != null) {
    await admin
      .from("vehicles")
      .update({ mileage })
      .eq("id", vehicleId)
      .or(`mileage.is.null,mileage.lt.${mileage}`);
  }

  for (let i = 0; i < photos.length; i++) {
    // 実バイト(マジックナンバー)で画像か検証。拡張子/申告MIMEは信用しない。
    const v = await validateImageFile(photos[i]);
    if (!v.ok) {
      console.warn("[add-history] rejected upload:", v.reason);
      continue;
    }
    const path = `vehicles/${vehicleId}/history/${Date.now()}-${i}.${v.ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, photos[i], { contentType: v.contentType });
    if (upErr) continue;
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    await admin.from("images").insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      history_id: history.id,
      image_url: pub.publicUrl,
    });
  }

  redirect(`/garage/${vehicleId}`);
}
