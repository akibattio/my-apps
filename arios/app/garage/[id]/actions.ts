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
