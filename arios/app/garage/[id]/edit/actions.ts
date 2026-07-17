"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";

export type EditVehicleState = { error?: string };

// 車の登録内容(メーカー/モデル/年式)を修正する。ログイン必須・本人の車のみ。
// ARIOS原則: 変更は audit_logs に before/after で記録する（訂正の履歴を残す）。
export async function updateVehicle(
  _prev: EditVehicleState,
  formData: FormData
): Promise<EditVehicleState> {
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const yearNum = yearRaw ? Number(yearRaw) : null;
  const year = yearNum && Number.isFinite(yearNum) ? Math.trunc(yearNum) : null;

  const admin = createAdminClient();

  // 所有権チェック＋変更前の値を取得
  const { data: before } = await admin
    .from("vehicles")
    .select("id, manufacturer, model, year")
    .eq("id", vehicleId)
    .eq("current_owner_id", owner.ownerId)
    .maybeSingle();
  if (!before) {
    return { error: "この車を編集する権限がありません。" };
  }

  const after = {
    manufacturer: manufacturer || null,
    model: model || null,
    year,
  };

  const { error } = await admin
    .from("vehicles")
    .update(after)
    .eq("id", vehicleId);
  if (error) {
    return { error: "更新に失敗しました。時間をおいて試してください。" };
  }

  // 変更履歴を残す（削除・上書きの証跡）
  await admin.from("audit_logs").insert({
    actor_id: owner.ownerId,
    target_table: "vehicles",
    target_id: vehicleId,
    action: "UPDATE",
    before_json: {
      manufacturer: before.manufacturer,
      model: before.model,
      year: before.year,
    },
    after_json: after,
  });

  redirect(`/garage/${vehicleId}`);
}
