"use server";

import { recognizeVehicle, type Recognition } from "@/lib/ai/recognize";
import { createAdminClient } from "@/lib/supabase/admin";

export type RecognizeResult =
  | ({ ok: true } & Recognition)
  | { ok: false; error: string };

// 写真から車両を推定して登録フォームの下書きを返す。
// 解析結果は ai_analyses に append-only で保存する（上書きしない）。
export async function recognizePhoto(
  base64: string,
  mediaType: string
): Promise<RecognizeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "AIキーが未設定です（.env の ANTHROPIC_API_KEY）。" };
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
