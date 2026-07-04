// 写真から車両を推定する（Vehicle Recognition）。
// 原則: AIは断定せず、確信度と根拠を返す。最終確認は人が行う（AI Assists）。
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // ANTHROPIC_API_KEY を環境変数から読む

// 構造化出力のスキーマ。不明な項目は空文字にし、確信度を下げる方針。
const SCHEMA = {
  type: "object",
  properties: {
    manufacturer: { type: "string", description: "メーカー名（例: トヨタ）。不明なら空文字" },
    model: { type: "string", description: "モデル名（例: スープラ）。不明なら空文字" },
    year: { type: "string", description: "推定年式（西暦4桁の文字列）。不明なら空文字" },
    confidence: { type: "number", description: "0〜1の確信度" },
    evidence: { type: "string", description: "判断の根拠を日本語で1〜2文。短く" },
  },
  required: ["manufacturer", "model", "year", "confidence", "evidence"],
  additionalProperties: false,
} as const;

export type Recognition = {
  manufacturer: string;
  model: string;
  year: string;
  confidence: number;
  evidence: string;
};

export async function recognizeVehicle(
  base64: string,
  mediaType: string
): Promise<{ parsed: Recognition; modelName: string }> {
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text:
              "この写真に写っている車またはバイクを推定してください。" +
              "メーカー・モデル・年式・確信度・根拠をスキーマ通りに返してください。" +
              "断定できない項目は空文字にし、確信度を低めにしてください。推測を事実として書かないこと。",
          },
        ],
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答を解析できませんでした。");
  }
  const parsed = JSON.parse(textBlock.text) as Recognition;
  return { parsed, modelName: res.model };
}
