"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";
import { validateImageFile } from "@/lib/upload";
import { rateLimitDb } from "@/lib/ratelimit";
import { getLang } from "@/lib/lang";
import { tr, fill } from "@/lib/i18n";
import { normalizeVin, isValidVin } from "@/app/listings/vin";
import { findOrCreateVehicle, assignOwnerOrClaim } from "@/lib/vehicles";
import { notifyGarageClaim } from "@/lib/notify";

const BUCKET = "vehicle-images";
const MAX_PHOTOS = 10; // RegisterForm と同じ値

export type RegisterState = { error?: string };

// マイガレージへの車の登録（売らない車も）。ログイン必須・車体番号必須。
// 1つの車体番号につき車の記録は1つ。すでに別の会員が持ち主なら書き換えず、運営の確認待ちにする。
export async function registerVehicle(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const t = tr(await getLang());
  const owner = await ensureOwner();
  if (!owner) redirect("/login?next=/register");

  const rl = await rateLimitDb(`garage:register:${owner.userId}`, 10, 60 * 60_000);
  if (!rl.ok) return { error: t("signup_err_rate") };

  const vin = normalizeVin(String(formData.get("vin") ?? ""));
  const manufacturer = String(formData.get("manufacturer") ?? "").trim().slice(0, 100);
  const model = String(formData.get("model") ?? "").trim().slice(0, 100);
  const yearRaw = String(formData.get("year") ?? "").trim();
  const yearNum = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
  const year = yearNum && yearNum >= 1885 && yearNum <= 2100 ? yearNum : null;
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!isValidVin(vin)) return { error: t("sell_vin_err") };
  if (!manufacturer || !model) return { error: t("form_err_makermodel") };
  if (photos.length > MAX_PHOTOS) return { error: fill(t("reg_err_photos"), { n: MAX_PHOTOS }) };

  const vehicle = await findOrCreateVehicle(vin, manufacturer, model, "MEMBER", { year });
  if (!vehicle) return { error: t("reg_err_failed") };

  const result = await assignOwnerOrClaim(vehicle, owner.ownerId, "MEMBER");
  if (result === "CLAIMED") {
    after(() =>
      notifyGarageClaim({
        vehicleId: vehicle.id,
        vin,
        manufacturer,
        model,
        email: owner.email,
        hadOwner: !!vehicle.currentOwnerId,
      })
    );
    redirect(`/garage?pending=${vehicle.currentOwnerId ? "1" : "2"}`);
  }
  if (result === "ALREADY_MINE") redirect(`/garage/${vehicle.id}`);

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 既存の記録（売りたい登録から作られたもの等）を引き継いだ場合は、車名を上書きしない。
  if (!vehicle.created && year) {
    await supabase.from("vehicles").update({ year }).eq("id", vehicle.id).is("year", null);
  }

  // この車の記録の起点（表示は「LIFE LINE GARAGE に登録」）
  const { data: history } = await supabase
    .from("histories")
    .insert({
      vehicle_id: vehicle.id,
      owner_id: owner.ownerId,
      history_type: "OTHER",
      event_date: today,
      source: "MEMBER_REGISTRATION",
      visibility: "PRIVATE",
    })
    .select("id")
    .single();

  // 写真（1枚失敗しても他は続行）。実バイトで画像か検証する。
  for (let i = 0; i < photos.length; i++) {
    const v = await validateImageFile(photos[i]);
    if (!v.ok) {
      console.warn("[register] rejected upload:", v.reason);
      continue;
    }
    const path = `vehicles/${vehicle.id}/${String(i).padStart(2, "0")}-${Date.now()}.${v.ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, photos[i], { contentType: v.contentType, upsert: false });
    if (upErr) {
      console.error("[register] image upload failed:", upErr);
      continue;
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await supabase.from("images").insert({
      vehicle_id: vehicle.id,
      owner_id: owner.ownerId,
      history_id: history?.id ?? null,
      image_url: pub.publicUrl,
      image_type: i === 0 ? "EXTERIOR" : null,
    });
  }

  redirect(`/garage/${vehicle.id}`);
}
