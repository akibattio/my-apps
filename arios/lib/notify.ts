import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE, PARTY_LABEL } from "@/app/admin/inquiries/constants";
import type { Lang } from "@/lib/i18n";
import { carKey } from "@/lib/carname";
import type { VehicleLink } from "@/lib/vehicles";

// 通知メール（Resend の送信API）。登録・マッチを運営が取りこぼさないためのもの。
// RESEND_API_KEY が無い環境では何もしない（登録処理は止めない）。
const FROM = process.env.NOTIFY_FROM?.trim() || "LIFE LINE GARAGE <no-reply@mail.arios.info>";

// 運営への通知先は環境変数 ADMIN_NOTIFY_EMAILS（カンマ区切り）。既定値は置かない。
// 未設定なら送らず、サーバーのログに残す。
function adminRecipients(): string[] {
  const list = (process.env.ADMIN_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  if (list.length === 0) console.warn("[notify] 通知先が未設定です（ADMIN_NOTIFY_EMAILS）。運営への通知は送りません。");
  return list;
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
  vehicle?: VehicleLink | null;
  receiptTo: string | null; // 受付メールの宛先（ログイン中の本人のアドレス。フォームの入力は使わない）
};

// 新規登録の後に呼ぶ: 運営への新着通知・マッチ通知、会員への受付メール。
export async function notifyNewListing(l: NewListing): Promise<void> {
  const supabase = createAdminClient();
  const opposite = l.kind === "SELL" ? "BUY" : "SELL";
  const { data: candidates } = await supabase
    .from("inquiries")
    .select("id, manufacturer, model")
    .eq("kind", opposite)
    .in("status", STATUS_ACTIVE)
    .limit(2000);
  const target = carKey(l.manufacturer, l.model);
  const matches = (candidates ?? []).filter((r) => carKey(r.manufacturer, r.model) === target);

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
  if (l.vehicle) {
    lines.push(
      "",
      l.vehicle.created
        ? "車の記録: この車体番号で新しく作りました。"
        : "車の記録: この車体番号の記録がすでにあり、そこにつなぎました。",
      ...(l.vehicle.otherListings > 0
        ? [`★ 同じ車体番号の売りたい登録がほかに${l.vehicle.otherListings}件あります（重複・仲介の重なりを確認してください）。`]
        : []),
      ...(l.vehicle.ownerConflict
        ? ["⚠ この車体番号は別の会員の車として登録済みです。持ち主の確認待ちにしました（管理画面の車両で判断してください）。"]
        : []),
      `車の記録: ${site}/admin/vehicles/${l.vehicle.vehicleId}`
    );
  }
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
    `${matches.length > 0 ? "【マッチ】" : "【新着】"}${l.vehicle?.ownerConflict ? "【持ち主確認】" : ""}${kindJa}: ${l.manufacturer} ${l.model}`,
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
  if (l.receiptTo) await sendMail([l.receiptTo], receipt.subject, receipt.text);
}

// マイガレージの登録で、別の会員の車として登録済みの車体番号が来たとき（持ち主の確認待ち）。
export async function notifyGarageClaim(c: {
  vehicleId: string;
  vin: string;
  manufacturer: string | null;
  model: string | null;
  email: string | null;
}): Promise<void> {
  const site = siteUrl();
  const car = [c.manufacturer, c.model].filter(Boolean).join(" ") || "（車名なし）";
  await sendMail(
    adminRecipients(),
    `【持ち主確認】マイガレージ: ${car}`,
    [
      "マイガレージに、別の会員の車として登録済みの車体番号で登録がありました。",
      "持ち主は書き換えず、確認待ちにしています。両方の会員に確認してから判断してください。",
      "",
      `車両: ${car}`,
      `車体番号: ${c.vin}`,
      `登録しようとした会員: ${c.email ?? "—"}`,
      "",
      `車の記録: ${site}/admin/vehicles/${c.vehicleId}`,
    ].join("\n")
  );
}
