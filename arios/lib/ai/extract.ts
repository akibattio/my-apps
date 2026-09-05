// 売買リードの情報抽出（AI取り込み）。写真・スクショ・書類画像・貼り付けテキストから抽出。
// 原則: 断定せず confidence と evidence を返す。最終確認は人（AI Assists）。社内(管理)専用。
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // ANTHROPIC_API_KEY を環境変数から

// 抽出モデル。コスト重視で Sonnet を使用。
const MODEL = "claude-sonnet-5";

const SCHEMA = {
  type: "object",
  properties: {
    manufacturer: { type: "string", description: "メーカー名（例: フェラーリ）。不明なら空文字" },
    model: { type: "string", description: "車種/モデル名（例: 488 Pista）。不明なら空文字" },
    year: { type: "string", description: "年式（西暦4桁）。不明なら空文字" },
    vin: { type: "string", description: "車体番号/VIN/Chassis No。不明なら空文字" },
    mileage: { type: "string", description: "走行距離（例: 12000km）。不明なら空文字" },
    color: { type: "string", description: "ボディカラー。不明なら空文字" },
    price: { type: "string", description: "価格（販売価格 or 予算、数字のみ・円）。不明なら空文字" },
    conditions: {
      type: "string",
      description: "希望条件・状態など（事故歴/改造/オプション/内装色 等）を短くまとめる。無ければ空文字",
    },
    name: { type: "string", description: "相手の氏名/会社名。不明なら空文字" },
    contact: { type: "string", description: "連絡先(電話/LINE ID/メール)。不明なら空文字" },
    confidence: { type: "number", description: "0〜1の全体確信度" },
    evidence: { type: "string", description: "判断の根拠を日本語で1〜2文。短く" },
  },
  required: ["manufacturer", "model", "confidence", "evidence"],
  additionalProperties: false,
} as const;

export type Extraction = {
  manufacturer: string;
  model: string;
  year?: string;
  vin?: string;
  mileage?: string;
  color?: string;
  price?: string;
  conditions?: string;
  name?: string;
  contact?: string;
  confidence: number;
  evidence: string;
};

type ImageInput = { base64: string; mediaType: string };

function promptFor(kind: "SELL" | "BUY") {
  const which =
    kind === "BUY"
      ? "「買いたい（探している車）」の条件"
      : "「売りたい（在庫）」の車両情報";
  return (
    `これは車の写真、または LINE/WhatsApp/メールのスクリーンショット、車検証・書類・スペック表などです。` +
    `ここから${which}を抽出し、スキーマ通りに返してください。` +
    `価格は数字のみ（円）。断定できない項目は空文字にし、confidence を下げてください。推測を事実として書かないこと。`
  );
}

async function run(
  content: Anthropic.MessageParam["content"]
): Promise<{ parsed: Extraction; modelName: string }> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答を解析できませんでした。");
  }
  return { parsed: JSON.parse(textBlock.text) as Extraction, modelName: res.model };
}

export async function extractFromImages(images: ImageInput[], kind: "SELL" | "BUY") {
  const content: Anthropic.MessageParam["content"] = [
    ...images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp",
        data: img.base64,
      },
    })),
    { type: "text" as const, text: promptFor(kind) },
  ];
  return run(content);
}

export async function extractFromText(text: string, kind: "SELL" | "BUY") {
  const content: Anthropic.MessageParam["content"] = [
    { type: "text", text: promptFor(kind) + "\n\n---\n" + text.slice(0, 8000) },
  ];
  return run(content);
}
