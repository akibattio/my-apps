"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";

const BUCKET = "vehicle-images";
const MAX_PHOTOS = 10;

export type RegisterState = { error?: string };

// 公開登録（Step 1）。ログイン不要。写真＋最小限の手入力で Vehicle と最初の History を作る。
// 認証・RLSポリシーは Step 2 以降で入れるため、ここではサーバー側の service_role で書き込む。
export async function registerVehicle(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (photos.length === 0 && !manufacturer && !model) {
    return { error: "写真か車名（メーカー・モデル）のどちらかは入力してください。" };
  }
  if (photos.length > MAX_PHOTOS) {
    return { error: `写真は最大${MAX_PHOTOS}枚までです。` };
  }

  const yearNum = yearRaw ? Number(yearRaw) : null;
  const year = yearNum && Number.isFinite(yearNum) ? Math.trunc(yearNum) : null;

  const supabase = createAdminClient();

  // ログイン中なら所有者として紐付ける（未ログインなら owner なしで登録）
  const owner = await ensureOwner();

  // 1. Vehicle（永久・削除不可）
  const { data: vehicle, error: vErr } = await supabase
    .from("vehicles")
    .insert({
      manufacturer: manufacturer || null,
      model: model || null,
      year,
      status: "REGISTERED",
      current_owner_id: owner?.ownerId ?? null,
    })
    .select("id")
    .single();

  if (vErr || !vehicle) {
    return { error: "車両の作成に失敗しました。時間をおいて試してください。" };
  }
  const vehicleId = vehicle.id as string;

  // 2. Ownership（所有履歴。ログイン時のみ）
  const today0 = new Date().toISOString().slice(0, 10);
  if (owner) {
    await supabase.from("ownerships").insert({
      vehicle_id: vehicleId,
      owner_id: owner.ownerId,
      is_current: true,
      start_date: today0,
      source: "REGISTRATION",
    });
  }

  // 3. 最初の History（この車の Timeline の起点）
  const { data: history } = await supabase
    .from("histories")
    .insert({
      vehicle_id: vehicleId,
      owner_id: owner?.ownerId ?? null,
      history_type: "OTHER",
      title: "ARIOSに登録",
      description: "この車の記録がARIOSで始まりました。",
      event_date: today0,
      source: "PUBLIC_REGISTRATION",
      visibility: "PUBLIC",
    })
    .select("id")
    .single();

  // 4. 写真を Storage にアップロードして images に記録（1枚失敗しても他は続行）
  for (let i = 0; i < photos.length; i++) {
    const file = photos[i];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `vehicles/${vehicleId}/${String(i).padStart(2, "0")}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (upErr) continue;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await supabase.from("images").insert({
      vehicle_id: vehicleId,
      history_id: history?.id ?? null,
      image_url: pub.publicUrl,
      image_type: i === 0 ? "EXTERIOR" : null,
    });
  }

  redirect(`/thank-you?v=${vehicleId}`);
}
