"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import { rateLimitDb } from "@/lib/ratelimit";

export type EditVehicleState = { error?: string };

const ACCIDENT = ["YES", "NO", "UNKNOWN"];
const text = (formData: FormData, key: string, max: number) =>
  String(formData.get(key) ?? "").trim().slice(0, max) || null;

// 車の登録内容とプロフィール（色・アピールポイント・純正オプション・事故歴）を修正する。
// ログイン必須・本人の車のみ。車体番号はここでは変えない（運営に連絡）。
// ARIOS原則: 変更は audit_logs に before/after で記録する（訂正の履歴を残す）。
export async function updateVehicle(
  _prev: EditVehicleState,
  formData: FormData
): Promise<EditVehicleState> {
  const t = tr(await getLang());
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const rl = await rateLimitDb(`garage:edit:user:${owner.userId}`, 30, 60 * 60_000);
  if (!rl.ok) return { error: t("signup_err_rate") };

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const yearRaw = String(formData.get("year") ?? "").trim();
  const yearNum = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
  const accidentRaw = String(formData.get("accidentHistory") ?? "");

  const after = {
    manufacturer: text(formData, "manufacturer", 60),
    model: text(formData, "model", 100),
    year: yearNum && yearNum >= 1885 && yearNum <= 2100 ? yearNum : null,
    exterior_color: text(formData, "exteriorColor", 60),
    interior_color: text(formData, "interiorColor", 60),
    appeal_points: text(formData, "appealPoints", 2000),
    factory_options: text(formData, "factoryOptions", 2000),
    accident_history: ACCIDENT.includes(accidentRaw) ? accidentRaw : null,
  };

  const admin = createAdminClient();

  // 所有権チェック＋変更前の値を取得
  const { data: before } = await admin
    .from("vehicles")
    .select(
      "id, manufacturer, model, year, exterior_color, interior_color, appeal_points, factory_options, accident_history"
    )
    .eq("id", vehicleId)
    .eq("current_owner_id", owner.ownerId)
    .maybeSingle();
  if (!before) {
    return { error: t("ah_err_perm") };
  }

  const { error } = await admin.from("vehicles").update(after).eq("id", vehicleId);
  if (error) {
    console.error("[garage/edit] update failed:", error);
    return { error: t("ev_err") };
  }

  // 変更履歴を残す（削除・上書きの証跡）
  const { id: _id, ...beforeValues } = before;
  void _id;
  await admin.from("audit_logs").insert({
    actor_id: owner.ownerId,
    target_table: "vehicles",
    target_id: vehicleId,
    action: "UPDATE",
    before_json: beforeValues,
    after_json: after,
  });

  redirect(`/garage/${vehicleId}`);
}
