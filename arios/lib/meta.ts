import type { Metadata } from "next";
import { getLang } from "@/lib/lang";

// ブラウザのタブ名を表示言語に合わせる（お客様向け画面用）。
export async function pageTitle(ja: string, en: string, description?: { ja: string; en: string }): Promise<Metadata> {
  const lang = await getLang();
  const t = lang === "en" ? en : ja;
  return {
    title: `${t} — LIFE LINE GARAGE`,
    ...(description ? { description: lang === "en" ? description.en : description.ja } : {}),
  };
}
