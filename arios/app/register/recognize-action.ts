"use server";

import { headers } from "next/headers";
import { recognizeVehicle, type Recognition } from "@/lib/ai/recognize";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

export type RecognizeResult =
  | ({ ok: true } & Recognition)
  | { ok: false; error: string };

// 写真から車両を推定して登録フォームの下書きを返す。
// 解析結果は ai_analyses に append-only で保存する（上書きしない）。
export async function recognizePhoto(
  base64: string,
  mediaType: string
): Promise<RecognizeResult> {
  // 認証必須（有料AIの無認証乱用を防ぐ）
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AIキーが未設定です（.env の ANTHROPIC_API_KEY）。" };
  }

  // AI費用の乱打対策: IP単位でレート制限（1分に10回 / 1日に40回）。
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const perMin = rateLimit(`ai:min:${ip}`, 10, 60_000);
  const perDay = rateLimit(`ai:day:${ip}`, 40, 24 * 60 * 60_000);
  if (!perMin.ok || !perDay.ok) {
    return {
      ok: false,
      error: "AI下書きの利用が集中しています。少し時間をおいてお試しください。",
    };
  }

  try {
    const { parsed, modelName } = await recognizeVehicle(base64, mediaType);

    const admin = createAdminClient();
    await admin.from("ai_analyses").insert({
      analysis_type: "VEHICLE_RECOGNITION",
      output_json: parsed,
      confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : null,
      model_name: modelName,
      prompt_version: "recognize-v1",
    });

    return { ok: true, ...parsed };
  } catch {
    return { ok: false, error: "AI解析に失敗しました。時間をおいて試してください。" };
  }
}
