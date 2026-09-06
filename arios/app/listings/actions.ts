"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { sellerOrder } from "./order";
import { matchKey } from "@/app/admin/matching/key";

const BUCKET = "inquiry-photos";
const MAX_PHOTOS = 30;
const PARTY_TYPES = ["OWNER", "BROKER", "DEALER"];

export type ListingState = { error?: string };

// 公開フォームからの送信（買いたい/売りたい）。認証不要・スパム対策あり。
async function submit(kind: "SELL" | "BUY", formData: FormData): Promise<ListingState> {
  // ハニーポット（botが埋める隠しフィールド）→ 成功したふりで無視
  if (String(formData.get("company") ?? "").trim()) {
    redirect(`/submitted?kind=${kind}`);
  }

  // IP単位のレート制限
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const rl = rateLimit(`listing:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return { error: "送信が集中しています。少し時間をおいてお試しください。" };
  }

  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!manufacturer || !model) {
    return { error: "メーカーと車種（必須）を入力してください。" };
  }

  const priceRaw = String(formData.get("price") ?? "").replace(/[,\s¥円]/g, "").trim();
  const price = priceRaw && /^\d+$/.test(priceRaw) ? Number(priceRaw) : null;
  const partyRaw = String(formData.get("partyType") ?? "").trim().toUpperCase();
  const partyType = PARTY_TYPES.includes(partyRaw)
    ? partyRaw
    : kind === "SELL"
      ? "OWNER"
      : null;
  const vin = String(formData.get("vin") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const contactMethod = String(formData.get("contactMethod") ?? "").trim();
  const channel = String(formData.get("channel") ?? "").trim() || null;
  const message = String(formData.get("message") ?? "").trim();

  // マイページ紐付け用メール。ログイン中なら本人のメールを最優先（確実に紐付く）。
  const user = await getCurrentUser();
  const emailRaw = (user?.email ?? String(formData.get("email") ?? "")).trim().toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;

  const photos =
    kind === "SELL"
      ? formData
          .getAll("photos")
          .filter((f): f is File => f instanceof File && f.size > 0)
      : [];
  if (photos.length > MAX_PHOTOS) {
    return { error: `写真は最大${MAX_PHOTOS}枚までです。` };
  }

  const supabase = createAdminClient();
  let id: string;
  try {
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        kind,
        manufacturer,
        model,
        price,
        party_type: partyType,
        vin: vin || null,
        name: name || null,
        contact: contact || null,
        contact_method: contactMethod || null,
        channel,
        message: message || null,
        email,
        source: "WEB_FORM",
        status: "NEW",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[listing] insert failed:", error);
      return { error: "送信に失敗しました。時間をおいてお試しください。" };
    }
    id = data.id as string;

    const paths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `inquiries/${id}/${String(i).padStart(2, "0")}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) {
        console.error("[listing] upload failed:", upErr);
        continue;
      }
      paths.push(path);
    }
    if (paths.length > 0) {
      await supabase.from("inquiries").update({ photo_urls: paths }).eq("id", id);
    }
  } catch (e) {
    console.error("[listing] unexpected:", e);
    return { error: "送信に失敗しました。通信環境をご確認ください。" };
  }

  redirect(`/submitted?kind=${kind}`);
}

export async function submitSell(_prev: ListingState, formData: FormData) {
  return submit("SELL", formData);
}
export async function submitBuy(_prev: ListingState, formData: FormData) {
  return submit("BUY", formData);
}

// 売り手の優先順位を上下に変更（管理者のみ）。
// 同じメーカー×車種の売り手を現在の並び順で取得し、隣と入れ替えて priority を再採番する。
export async function reorderSeller(formData: FormData): Promise<void> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  if (!id) redirect("/admin/matching");

  const supabase = createAdminClient();
  const { data: cur } = await supabase
    .from("inquiries")
    .select("id, manufacturer, model")
    .eq("id", id)
    .maybeSingle();
  if (!cur) redirect("/admin/matching");

  const { data: sellers } = await supabase
    .from("inquiries")
    .select("id, price, priority")
    .eq("kind", "SELL")
    .eq("manufacturer", cur.manufacturer)
    .eq("model", cur.model);

  const ordered = (sellers ?? []).slice().sort(sellerOrder);
  const idx = ordered.findIndex((s) => s.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx >= 0 && swap >= 0 && swap < ordered.length) {
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
  }
  // 現在の並びを priority=0..n で確定
  for (let i = 0; i < ordered.length; i++) {
    await supabase.from("inquiries").update({ priority: i }).eq("id", ordered[i].id);
  }

  // 操作した車のマッチング詳細に留まる
  redirect(`/admin/matching/${matchKey(cur.manufacturer ?? "", cur.model ?? "")}`);
}
