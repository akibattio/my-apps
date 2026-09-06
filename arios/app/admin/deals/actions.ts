"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth";
import { DEAL_STATUS_LABEL } from "./constants";

// 数値(価格)入力を正規化。カンマ・¥・円・空白を除去し、数字のみを許可。
function parsePrice(raw: string): number | null {
  const s = raw.replace(/[,\s¥円]/g, "").trim();
  return s && /^\d+$/.test(s) ? Number(s) : null;
}

// マッチング詳細から「取引を作成」。買い×売りの inquiry を紐付けて1件作る。
export async function createDeal(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const manufacturer = String(formData.get("manufacturer") ?? "").trim() || null;
  const model = String(formData.get("model") ?? "").trim() || null;
  const buyerId = String(formData.get("buyerId") ?? "").trim() || null;
  const sellerId = String(formData.get("sellerId") ?? "").trim() || null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      manufacturer,
      model,
      buyer_inquiry_id: buyerId,
      seller_inquiry_id: sellerId,
      status: "IN_PROGRESS",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[deal] create failed:", error);
    redirect("/admin/matching");
  }
  const id = data!.id as string;

  await supabase.from("deal_events").insert({
    deal_id: id,
    body: `取引を作成しました（${manufacturer ?? ""} ${model ?? ""}）`,
  });

  redirect(`/admin/deals/${id}`);
}

// 契約情報（成約価格・成約日・メモ）を保存。
export async function saveDealContract(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/deals");

  const agreedPrice = parsePrice(String(formData.get("agreedPrice") ?? ""));
  const contractRaw = String(formData.get("contractDate") ?? "").trim();
  const contractDate = /^\d{4}-\d{2}-\d{2}$/.test(contractRaw) ? contractRaw : null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = createAdminClient();
  await supabase
    .from("deals")
    .update({
      agreed_price: agreedPrice,
      contract_date: contractDate,
      note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  redirect(`/admin/deals/${id}`);
}

// 状態変更。CLOSED にしたら紐付いた買い/売りの inquiry も成約(CLOSED)にして
// 有効一覧（買いたい/売りたい/マッチング）から落とす。
export async function setDealStatus(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !DEAL_STATUS_LABEL[status]) redirect("/admin/deals");

  const supabase = createAdminClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("id, buyer_inquiry_id, seller_inquiry_id")
    .eq("id", id)
    .maybeSingle();
  if (!deal) redirect("/admin/deals");

  await supabase
    .from("deals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (status === "CLOSED") {
    const inqIds = [deal.buyer_inquiry_id, deal.seller_inquiry_id].filter(
      (x): x is string => !!x
    );
    if (inqIds.length > 0) {
      await supabase
        .from("inquiries")
        .update({ status: "CLOSED", updated_at: new Date().toISOString() })
        .in("id", inqIds);
    }
  }

  await supabase.from("deal_events").insert({
    deal_id: id,
    body: `状態を「${DEAL_STATUS_LABEL[status]}」に変更`,
  });

  redirect(`/admin/deals/${id}`);
}

// 進行履歴を1行追加（追記のみ）。
export async function addDealEvent(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const id = String(formData.get("id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!id) redirect("/admin/deals");
  if (!body) redirect(`/admin/deals/${id}`);

  const supabase = createAdminClient();
  await supabase.from("deal_events").insert({ deal_id: id, body });
  await supabase.from("deals").update({ updated_at: new Date().toISOString() }).eq("id", id);

  redirect(`/admin/deals/${id}`);
}
