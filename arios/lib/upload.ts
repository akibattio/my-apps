// 画像アップロードのサーバー側検証。
// クライアントの accept="image/*"・申告 MIME・拡張子はいずれも偽装できるため信用せず、
// 実バイト（マジックナンバー）で画像形式を判定する。
// 保存ファイル名の拡張子・contentType は「判定結果」から決める（ユーザー入力は使わない）。

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 1枚あたり 8MB まで

type ImageKind = { ext: "jpg" | "png" | "webp"; contentType: string };

export type ValidatedImage =
  | ({ ok: true } & ImageKind)
  | { ok: false; reason: "empty" | "too_large" | "not_image" };

// 先頭バイトから画像形式を判定（拡張子・申告 MIME は信用しない）。
function sniffImage(b: Uint8Array): ImageKind | null {
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

// 1ファイルを検証する。OK なら保存用の拡張子・contentType を返す。
export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (!file || file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniffImage(head);
  if (!kind) return { ok: false, reason: "not_image" };
  return { ok: true, ...kind };
}
