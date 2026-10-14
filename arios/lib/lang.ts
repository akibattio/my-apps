// サーバー側で現在の表示言語を判定する。
// 優先順位: Cookie "lang"（手動切替）→ ブラウザの Accept-Language で自動判定 → 既定は日本語。
import { cookies, headers } from "next/headers";
import type { Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  const cookieLang = c.get("lang")?.value;
  if (cookieLang === "en" || cookieLang === "ja") return cookieLang;

  // 手動指定が無ければブラウザ言語で自動判定。
  const h = await headers();
  const al = (h.get("accept-language") ?? "").toLowerCase().trim();
  if (!al) return "ja"; // 不明なら日本語
  const first = al.split(",")[0].trim();
  if (first.startsWith("ja")) return "ja"; // 日本語ブラウザ→日本語
  return "en"; // それ以外（海外ブラウザ）→英語
}
