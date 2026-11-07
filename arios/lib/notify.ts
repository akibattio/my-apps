import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE, PARTY_LABEL } from "@/app/admin/inquiries/constants";
import type { Lang } from "@/lib/i18n";

// 通知メール（Resend の送信API）。登録・マッチを運営が取りこぼさないためのもの。
// RESEND_API_KEY が無い環境では何もしない（登録処理は止めない）。
const FROM = process.env.NOTIFY_FROM?.trim() || "LIFE LINE GARAGE <no-reply@mail.arios.info>";

function adminRecipients(): string[] {
  const raw = process.env.ADMIN_NOTIFY_EMAILS?.trim() || "arios.suzuki@gmail.com";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://my-apps-akibattios-projects.vercel.app").replace(/\/+$/, "");
}

// 件名に改行などが混ざらないようにする。
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").slice(0, 120);

async function sendMail(to: string[], subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || to.length === 0) {
    if (!key) console.warn("[notify] RESEND_API_KEY 未設定のため送信をスキップ:", oneLine(subject));
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject: oneLine(subject), text }),
    });
    if (!res.ok) console.error("[notify] send failed:", res.status, (await res.text()).slice(0, 300));
  } catch (e) {
    console.error("[notify] send error:", e);
  }
}

// マッチ判定用キー（メーカー×車種、前後空白・大小文字を無視）。
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export type NewListing = {
  id: string;
  kind: "SELL" | "BUY";
  manufacturer: string;
  model: string;
  price: number | null;
  partyType: string | null;
  vin: string | null;
  ownerName: string | null;
  name: string;
  company: string | null;
  contactMethod: string | null;
  contact: string;
  email: string;
  message: string | null;
  photoCount: number;
  lang: Lang;
};

// 新規登録の後に呼ぶ: 運営への新着通知・マッチ通知、会員への受付メール。
export async function notifyNewListing(l: NewListing): Promise<void> {
  const supabase = createAdminClient();
  const opposite = l.kind === "SELL" ? "BUY" : "SELL";
  const { data: candidates } = await supabase
    .from("inquiries")
    .select("id, manufacturer, model, price, name, contact_method, contact")
    .eq("kind", opposite)
    .in("status", STATUS_ACTIVE)
    .ilike("manufacturer", l.manufacturer.trim())
    .limit(200);
  const matches = (candidates ?? []).filter(
    (r) => norm(r.manufacturer) === norm(l.manufacturer) && norm(r.model) === norm(l.model)
  );

  const kindJa = l.kind === "SELL" ? "売りたい" : "買いたい";
  const yen = (n: number | null) => (n != null ? "¥" + n.toLocaleString("ja-JP") : "—");
  const contactLabel = l.contactMethod === "LINE" ? "LINE ID" : l.contactMethod === "PHONE" ? "電話番号" : "連絡先";
  const site = siteUrl();

  const lines = [
    `新しい「${kindJa}」の登録がありました。`,
    "",
    `車両: ${l.manufacturer} ${l.model}`,
    `${l.kind === "SELL" ? "販売価格" : "希望価格"}: ${yen(l.price)}`,
    ...(l.kind === "SELL"
      ? [
          `区分: ${l.partyType ? PARTY_LABEL[l.partyType] ?? l.partyType : "—"}`,
          `車体番号: ${l.vin ?? "—"}`,
          ...(l.ownerName ? [`オーナー本人の名前: ${l.ownerName}（本人からの依頼あり にチェック済み）`] : []),
          `写真: ${l.photoCount}枚`,
        ]
      : []),
    "",
    `お名前: ${l.name}${l.company ? `（${l.company}）` : ""}`,
    `${contactLabel}: ${l.contact}`,
    `メール: ${l.email}`,
    `登録時の言語: ${l.lang === "en" ? "英語" : "日本語"}`,
    ...(l.message ? ["", "メモ:", l.message] : []),
    "",
    `詳細: ${site}/admin/inquiries/${l.id}`,
  ];
  if (matches.length > 0) {
    lines.push(
      "",
      `★ この登録は「${l.kind === "SELL" ? "買いたい" : "売りたい"}」${matches.length}件とマッチしています。`,
      `マッチング: ${site}/admin/matching`
    );
  }

  const admins = adminRecipients();
  await sendMail(
    admins,
    `${matches.length > 0 ? "【マッチ】" : "【新着】"}${kindJa}: ${l.manufacturer} ${l.model}`,
    lines.join("\n")
  );

  // 会員への受付メール（登録したときの言語で）。連絡先は相手に公開されない旨も添える。
  const receipt =
    l.lang === "en"
      ? {
          subject: `We've received your registration: ${l.manufacturer} ${l.model}`,
          text: [
            `Thank you for registering with LIFE LINE GARAGE.`,
            "",
            `${l.kind === "SELL" ? "Sell" : "Buy"}: ${l.manufacturer} ${l.model}`,
            "",
            l.kind === "SELL"
              ? "When there's a buyer who matches, our team will check the details and contact both sides."
              : "When a matching car is registered, our team will be in touch.",
            "Your contact details are never shown to the other party.",
            "",
            `You can check or edit your registration on My Page: ${site}/mypage`,
            "",
            "— LIFE LINE GARAGE",
            "(This is an automated message. Replies to this address are not monitored.)",
          ].join("\n"),
        }
      : {
          subject: `登録を受け付けました：${l.manufacturer} ${l.model}`,
          text: [
            `LIFE LINE GARAGE へのご登録ありがとうございます。`,
            "",
            `${kindJa}：${l.manufacturer} ${l.model}`,
            "",
            l.kind === "SELL"
              ? "買いたい方とのマッチングを運営が確認して、双方にご連絡します。"
              : "マッチした車が見つかったときは、運営からご連絡します。",
            "連絡先が相手に公開されることはありません。",
            "",
            `登録内容の確認・修正はマイページから: ${site}/mypage`,
            "",
            "— LIFE LINE GARAGE",
            "（このメールは送信専用です。返信いただいても確認できません）",
          ].join("\n"),
        };
  await sendMail([l.email], receipt.subject, receipt.text);
}
