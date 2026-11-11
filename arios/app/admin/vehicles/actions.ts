"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth";

// 持ち主の確認待ちを判断する（管理者のみ）。
// 認める → 持ち主をその会員に切り替え、前の持ち主の所有記録を閉じる。認めない → 却下として残す。
export async function decideClaim(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const claimId = String(formData.get("claimId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!claimId || (decision !== "APPROVED" && decision !== "REJECTED")) redirect("/admin/vehicles");

  const supabase = createAdminClient();
  const { data: claim } = await supabase
    .from("vehicle_claims")
    .select("id, vehicle_id, owner_id, status")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) redirect("/admin/vehicles");
  const back = `/admin/vehicles/${claim.vehicle_id}`;
  if (claim.status !== "PENDING") redirect(back);

  const now = new Date().toISOString();
  if (decision === "APPROVED") {
    const { data: v } = await supabase
      .from("vehicles")
      .select("current_owner_id")
      .eq("id", claim.vehicle_id)
      .maybeSingle();
    const today = now.slice(0, 10);

    await supabase
      .from("ownerships")
      .update({ is_current: false, end_date: today })
      .eq("vehicle_id", claim.vehicle_id)
      .eq("is_current", true);
    await supabase.from("vehicles").update({ current_owner_id: claim.owner_id }).eq("id", claim.vehicle_id);
    await supabase.from("ownerships").insert({
      vehicle_id: claim.vehicle_id,
      owner_id: claim.owner_id,
      is_current: true,
      start_date: today,
      source: "CLAIM_APPROVED",
    });
    await supabase.from("histories").insert({
      vehicle_id: claim.vehicle_id,
      owner_id: claim.owner_id,
      history_type: "OWNERSHIP",
      title: "持ち主の変更（運営が確認）",
      event_date: today,
      source: "ADMIN",
      visibility: "ADMIN",
    });
    await supabase.from("audit_logs").insert({
      actor_id: admin.id,
      target_table: "vehicles",
      target_id: claim.vehicle_id,
      action: "OWNER_CHANGE",
      before_json: { current_owner_id: v?.current_owner_id ?? null },
      after_json: { current_owner_id: claim.owner_id, claim_id: claim.id },
    });
  }

  await supabase
    .from("vehicle_claims")
    .update({ status: decision, decided_at: now })
    .eq("id", claim.id);

  redirect(back);
}
