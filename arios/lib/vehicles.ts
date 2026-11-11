import { createAdminClient } from "@/lib/supabase/admin";
import { ownerIdForUser } from "@/lib/auth";
import { normalizeVin, isValidVin } from "@/app/listings/vin";
import { PARTY_LABEL } from "@/app/admin/inquiries/constants";

// 車体番号ごとの車の記録（1つの車体番号につき vehicles は1行）。
// 「売りたい」登録を車体番号で車の記録につなぐ。サーバー専用（service_role）。

export type VehicleLink = {
  vehicleId: string;
  created: boolean; // 今回はじめて車の記録を作ったか
  ownerConflict: boolean; // 別の会員が持ち主として登録済み → 確認待ちにした
  otherListings: number; // 同じ車体番号の、ほかの売りたい登録の数
};

type Listing = {
  id: string;
  vin: string | null;
  manufacturer: string | null;
  model: string | null;
  partyType: string | null;
  authUserId: string | null;
  email: string | null;
};

// 車体番号で車の記録を探す。無ければ作る（同時に作られたら作られた方を使う）。vin は正規化済みで渡す。
export async function findOrCreateVehicle(
  vin: string,
  manufacturer: string | null,
  model: string | null,
  source: "SELL_LISTING" | "MEMBER" | "ADMIN",
  extra: { year?: number | null } = {}
): Promise<{ id: string; currentOwnerId: string | null; created: boolean } | null> {
  const supabase = createAdminClient();
  const find = async () => {
    const { data } = await supabase
      .from("vehicles")
      .select("id, current_owner_id")
      .eq("vin_normalized", vin)
      .maybeSingle();
    return data;
  };

  const existing = await find();
  if (existing) return { id: existing.id, currentOwnerId: existing.current_owner_id, created: false };

  const { data: inserted, error } = await supabase
    .from("vehicles")
    .insert({ vin, manufacturer, model, year: extra.year ?? null, status: "REGISTERED", source })
    .select("id")
    .single();
  if (inserted) return { id: inserted.id, currentOwnerId: null, created: true };

  // 一意制約にかかった＝同時にほかの登録が作った
  if (error?.code === "23505") {
    const again = await find();
    if (again) return { id: again.id, currentOwnerId: again.current_owner_id, created: false };
  }
  console.error("[vehicles] create failed:", error);
  return null;
}

// 売りたい登録を車の記録につなぐ。失敗しても登録自体は止めない（null を返す）。
export async function linkListingToVehicle(l: Listing): Promise<VehicleLink | null> {
  const vin = normalizeVin(l.vin ?? "");
  if (!isValidVin(vin)) return null;

  try {
    const supabase = createAdminClient();
    const vehicle = await findOrCreateVehicle(vin, l.manufacturer, l.model, "SELL_LISTING");
    if (!vehicle) return null;

    const listerOwnerId = l.authUserId ? await ownerIdForUser(l.authUserId, l.email) : null;
    const today = new Date().toISOString().slice(0, 10);

    // 持ち主: オーナー本人の登録なら、その会員を持ち主にする。
    // すでに別の会員が持ち主なら書き換えず、確認待ちとして運営に判断してもらう。
    let ownerConflict = false;
    if (l.partyType === "OWNER" && listerOwnerId) {
      const r = await assignOwnerOrClaim(vehicle, listerOwnerId, "SELL_LISTING", l.id);
      ownerConflict = r === "CLAIMED";
    }

    await supabase.from("inquiries").update({ vehicle_id: vehicle.id }).eq("id", l.id);

    // 経緯の記録（運営だけが見る）。同じ登録・同じ車の記録は1件だけ。
    const { count: already } = await supabase
      .from("histories")
      .select("id", { count: "exact", head: true })
      .eq("inquiry_id", l.id)
      .eq("vehicle_id", vehicle.id);
    if (!already) {
      const party = l.partyType ? PARTY_LABEL[l.partyType] ?? l.partyType : "区分なし";
      await supabase.from("histories").insert({
        vehicle_id: vehicle.id,
        owner_id: listerOwnerId,
        history_type: "OTHER",
        title: `売りたい登録（${party}）`,
        event_date: today,
        source: "SELL_LISTING",
        visibility: "ADMIN",
        inquiry_id: l.id,
      });
    }

    const { count: others } = await supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", vehicle.id)
      .eq("kind", "SELL")
      .neq("id", l.id);

    return {
      vehicleId: vehicle.id,
      created: vehicle.created,
      ownerConflict,
      otherListings: others ?? 0,
    };
  } catch (e) {
    console.error("[vehicles] link failed:", e);
    return null;
  }
}

// 持ち主を決める。持ち主がいなければその会員にする。別の会員が持ち主なら確認待ちにする。
export async function assignOwnerOrClaim(
  vehicle: { id: string; currentOwnerId: string | null },
  ownerId: string,
  source: string,
  inquiryId: string | null = null
): Promise<"ASSIGNED" | "ALREADY_MINE" | "CLAIMED"> {
  const supabase = createAdminClient();
  if (vehicle.currentOwnerId === ownerId) return "ALREADY_MINE";

  if (!vehicle.currentOwnerId) {
    const { data: claimed } = await supabase
      .from("vehicles")
      .update({ current_owner_id: ownerId })
      .eq("id", vehicle.id)
      .is("current_owner_id", null)
      .select("id");
    if (claimed && claimed.length > 0) {
      await supabase.from("ownerships").insert({
        vehicle_id: vehicle.id,
        owner_id: ownerId,
        is_current: true,
        start_date: new Date().toISOString().slice(0, 10),
        source,
      });
      return "ASSIGNED";
    }
    // 同時にほかの会員が持ち主になった → 下の確認待ちへ
  }

  // 同じ会員の確認待ちがすでにあれば一意制約で弾かれる（それで良い）
  await supabase
    .from("vehicle_claims")
    .insert({ vehicle_id: vehicle.id, owner_id: ownerId, inquiry_id: inquiryId, status: "PENDING" });
  return "CLAIMED";
}
