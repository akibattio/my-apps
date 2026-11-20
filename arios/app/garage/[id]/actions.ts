"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureOwner } from "@/lib/auth";

// 公開ページ（パスポート）の公開・非公開を切り替える。本人の車のみ。最初は非公開。
export async function setVehiclePublic(formData: FormData): Promise<void> {
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const vehicleId = String(formData.get("vehicleId") ?? "");
  const isPublic = String(formData.get("public") ?? "") === "1";

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("vehicles")
    .select("id, is_public")
    .eq("id", vehicleId)
    .eq("current_owner_id", owner.ownerId)
    .maybeSingle();
  if (!before) redirect("/garage");

  if (before.is_public !== isPublic) {
    await admin.from("vehicles").update({ is_public: isPublic }).eq("id", vehicleId);
    await admin.from("audit_logs").insert({
      actor_id: owner.ownerId,
      target_table: "vehicles",
      target_id: vehicleId,
      action: "UPDATE",
      before_json: { is_public: before.is_public },
      after_json: { is_public: isPublic },
    });
  }

  redirect(`/garage/${vehicleId}`);
}

// 記録1件の公開・非公開を切り替える。今の持ち主で、かつその記録を書いた本人だけ（運営だけの記録は対象外）。
// 持ち主が代わった車でも、前の持ち主が書いた記録は、新しい持ち主には変えられない。
export async function setHistoryVisibility(formData: FormData): Promise<void> {
  const owner = await ensureOwner();
  if (!owner) redirect("/login");

  const historyId = String(formData.get("historyId") ?? "");
  const visibility = String(formData.get("public") ?? "") === "1" ? "PUBLIC" : "PRIVATE";

  const admin = createAdminClient();
  const { data: h } = await admin
    .from("histories")
    .select("id, vehicle_id, owner_id, visibility, vehicle:vehicle_id(current_owner_id)")
    .eq("id", historyId)
    .maybeSingle();
  const v = h ? (Array.isArray(h.vehicle) ? h.vehicle[0] : h.vehicle) : null;
  if (
    !h ||
    h.owner_id !== owner.ownerId ||
    (v as { current_owner_id: string | null } | null)?.current_owner_id !== owner.ownerId
  ) {
    redirect("/garage");
  }
  if (h.visibility !== "ADMIN" && h.visibility !== visibility) {
    await admin.from("histories").update({ visibility }).eq("id", h.id);
  }

  redirect(`/garage/${h.vehicle_id}#h-${h.id}`);
}
