"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin } from "@/lib/auth";
import {
  extractFromImages,
  extractFromText,
  type Extraction,
} from "@/lib/ai/extract";

export type ExtractResult = { ok: true; data: Extraction } | { ok: false; error: string };

// テキスト（チャット/メモ貼り付け）から抽出（管理者のみ）。
export async function aiExtractText(
  kind: "SELL" | "BUY",
  text: string
): Promise<ExtractResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "権限がありません。" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "AIキーが未設定です。" };
  if (!text.trim()) return { ok: false, error: "テキストを入力してください。" };
  try {
    const { parsed } = await extractFromText(text, kind);
    return { ok: true, data: parsed };
  } catch (e) {
    console.error("[ai-extract-text]", e);
    return { ok: false, error: "AI読み取りに失敗しました。時間をおいて試してください。" };
  }
}

// 画像（車両写真・スクショ・書類）から抽出（管理者のみ）。
export async function aiExtractImages(
  kind: "SELL" | "BUY",
  images: { base64: string; mediaType: string }[]
): Promise<ExtractResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "権限がありません。" };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "AIキーが未設定です。" };
  if (!images.length) return { ok: false, error: "画像を選んでください。" };
  try {
    const { parsed } = await extractFromImages(images.slice(0, 8), kind);
    return { ok: true, data: parsed };
  } catch (e) {
    console.error("[ai-extract-images]", e);
    return { ok: false, error: "AI読み取りに失敗しました。時間をおいて試してください。" };
  }
}

export type CreateState = { error?: string };

// 確認後の登録（管理者のみ）。source=AI_ASSIST。
export async function createListing(
  _prev: CreateState,
  formData: FormData
): Promise<CreateState> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const kind = String(formData.get("kind")) === "BUY" ? "BUY" : "SELL";
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  if (!manufacturer || !model) {
    return { error: "メーカーと車種（必須）を入力してください。" };
  }
  const priceRaw = String(formData.get("price") ?? "").replace(/[,\s¥円]/g, "").trim();
  const price = /^\d+$/.test(priceRaw) ? Number(priceRaw) : null;
  const partyRaw = String(formData.get("partyType") ?? "").trim().toUpperCase();
  const party_type = ["OWNER", "BROKER", "DEALER"].includes(partyRaw)
    ? partyRaw
    : kind === "SELL"
      ? "OWNER"
      : null;
  const vin = String(formData.get("vin") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim() || null;
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const contact_method = String(formData.get("contactMethod") ?? "").trim() || null;
  const channel = String(formData.get("channel") ?? "").trim() || null;
  const message = String(formData.get("message") ?? "").trim() || null;

  let id: string;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("inquiries")
      .insert({
        kind,
        manufacturer,
        model,
        price,
        party_type,
        vin,
        name,
        contact,
        contact_method,
        channel,
        message,
        source: "AI_ASSIST",
        status: "NEW",
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[create-listing]", error);
      return { error: "登録に失敗しました。時間をおいて試してください。" };
    }
    id = data.id as string;
  } catch (e) {
    console.error("[create-listing]", e);
    return { error: "登録に失敗しました。通信環境をご確認ください。" };
  }

  redirect(`/admin/inquiries/${id}`);
}
