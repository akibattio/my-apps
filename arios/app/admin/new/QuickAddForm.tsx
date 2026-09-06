"use client";

import { useActionState, useState, startTransition } from "react";
import {
  aiExtractText,
  aiExtractImages,
  createListing,
  type CreateState,
} from "./actions";
import { resizeImage } from "@/app/listings/resize";

const PARTIES = [
  { v: "OWNER", label: "オーナー" },
  { v: "BROKER", label: "ブローカー" },
  { v: "DEALER", label: "ディーラー" },
];
const CONTACTS = [
  { v: "PHONE", label: "電話" },
  { v: "LINE", label: "LINE ID" },
];
const CHANNELS = [
  { v: "LINE", label: "LINE" },
  { v: "WHATSAPP", label: "WhatsApp" },
  { v: "PHONE", label: "電話" },
  { v: "REFERRAL", label: "紹介" },
  { v: "OTHER", label: "その他" },
];

async function fileToPart(file: File) {
  const resized = await resizeImage(file, 1280, 0.7);
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(resized);
  });
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg" };
}

export default function QuickAddForm() {
  const [state, formAction, isPending] = useActionState<CreateState, FormData>(
    createListing,
    {}
  );

  const [kind, setKind] = useState<"SELL" | "BUY">("SELL");

  // AI取り込み
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // フィールド
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [vin, setVin] = useState("");
  const [party, setParty] = useState("OWNER");
  const [channel, setChannel] = useState("LINE");
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [registeredBy, setRegisteredBy] = useState<"STAFF" | "SELF">("STAFF");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function applyExtraction(d: {
    manufacturer?: string;
    model?: string;
    price?: string;
    vin?: string;
    year?: string;
    mileage?: string;
    color?: string;
    conditions?: string;
    name?: string;
    contact?: string;
    confidence?: number;
    evidence?: string;
  }) {
    if (d.manufacturer) setManufacturer(d.manufacturer);
    if (d.model) setModel(d.model);
    if (d.price) setPrice(d.price.replace(/[^\d]/g, ""));
    if (d.vin) setVin(d.vin);
    if (d.name) setName(d.name);
    if (d.contact) setContact(d.contact);
    const extras = [
      d.year ? `年式: ${d.year}` : null,
      d.mileage ? `走行: ${d.mileage}` : null,
      d.color ? `色: ${d.color}` : null,
      d.conditions || null,
    ]
      .filter(Boolean)
      .join(" / ");
    if (extras) setMessage((m) => (m ? m + "\n" + extras : extras));
    const pct = Math.round((d.confidence ?? 0) * 100);
    setAiNote(`AI読み取り（確信度 ${pct}%）：${d.evidence ?? ""}　※内容を確認・修正してください`);
  }

  async function onExtract() {
    setAiBusy(true);
    setAiError(null);
    setAiNote(null);
    try {
      let res;
      if (files.length > 0) {
        const parts = await Promise.all(files.map(fileToPart));
        res = await aiExtractImages(kind, parts);
      } else if (text.trim()) {
        res = await aiExtractText(kind, text);
      } else {
        setAiError("テキストを貼り付けるか、写真/スクショを選んでください。");
        return;
      }
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      applyExtraction(res.data);
    } catch {
      setAiError("読み取りに失敗しました。");
    } finally {
      setAiBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!manufacturer.trim() || !model.trim()) {
      setLocalError("メーカーと車種（必須）を入力してください。");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("manufacturer", manufacturer);
    fd.set("model", model);
    fd.set("price", price);
    fd.set("vin", vin);
    fd.set("partyType", party);
    fd.set("channel", channel);
    fd.set("contactMethod", contactMethod);
    fd.set("contact", contact);
    fd.set("name", name);
    fd.set("company_name", company);
    fd.set("email", email);
    fd.set("registeredBy", registeredBy);
    fd.set("message", message);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm ${
      active ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
    }`;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 種別 */}
      <div className="flex gap-2">
        {(["SELL", "BUY"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 rounded-full border px-4 py-3 text-sm font-medium ${
              kind === k ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
            }`}
          >
            {k === "SELL" ? "売りたい" : "買いたい"}
          </button>
        ))}
      </div>

      {/* 受付区分（本人 or 管理者の代理登録） */}
      <div>
        <label className={label}>登録者</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRegisteredBy("STAFF")}
            className={`flex-1 ${chip(registeredBy === "STAFF")}`}
          >
            管理者が代理で登録
          </button>
          <button
            type="button"
            onClick={() => setRegisteredBy("SELF")}
            className={`flex-1 ${chip(registeredBy === "SELF")}`}
          >
            お客様本人の申告
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          電話・LINE・来店など、こちらで受けて登録する場合は「代理」。お客様がメールで
          マイページ管理を希望する場合のみ、下のメールを入れて「本人」にします。
        </p>
      </div>

      {/* AI取り込みパネル */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
        <p className="mb-2 text-sm font-medium text-accent">✨ AIで読み取る</p>
        <p className="mb-3 text-xs text-muted">
          LINE/WhatsApp/メールのスクショや車の写真・書類、またはチャット文を貼り付け→AIが下書きします。
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="チャットやメモを貼り付け（例: Ferrari F40 red budget 250M buyer UK）"
          className={`${field} mb-2 min-h-20`}
        />
        <label className="mb-2 flex h-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-600 text-muted">
          <span className="text-sm">＋ 写真 / スクショ / 書類を選ぶ（最大8枚）</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}
          />
        </label>
        {files.length > 0 && (
          <p className="mb-2 text-xs text-muted">{files.length} 枚を選択中</p>
        )}
        <button
          type="button"
          onClick={onExtract}
          disabled={aiBusy}
          className="w-full rounded-lg border border-accent px-4 py-3 text-sm font-medium text-accent disabled:opacity-60"
        >
          {aiBusy ? "AIが読み取り中…" : "AIで読み取る"}
        </button>
        {aiNote && <p className="mt-2 text-xs text-muted">{aiNote}</p>}
        {aiError && <p className="mt-2 text-sm text-red-400">{aiError}</p>}
      </div>

      {/* フィールド（AIの下書きを確認・修正） */}
      <div>
        <label className={label}>メーカー <span className="text-red-400">必須</span></label>
        <input className={field} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="例: フェラーリ" />
      </div>
      <div>
        <label className={label}>車種 <span className="text-red-400">必須</span></label>
        <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder="例: 488 Pista" />
      </div>
      <div>
        <label className={label}>{kind === "BUY" ? "希望価格（円）" : "販売価格（円）"}</label>
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="例: 32000000" />
      </div>

      {kind === "SELL" && (
        <>
          <div>
            <label className={label}>区分</label>
            <div className="flex flex-wrap gap-2">
              {PARTIES.map((p) => (
                <button type="button" key={p.v} onClick={() => setParty(p.v)} className={chip(party === p.v)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>車体番号（任意）</label>
            <input className={field} value={vin} onChange={(e) => setVin(e.target.value)} placeholder="VIN / Chassis No" autoCapitalize="characters" />
          </div>
        </>
      )}

      <div>
        <label className={label}>受付経路</label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button type="button" key={c.v} onClick={() => setChannel(c.v)} className={chip(channel === c.v)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>連絡先</label>
        <div className="mb-2 flex gap-2">
          {CONTACTS.map((m) => (
            <button type="button" key={m.v} onClick={() => setContactMethod(m.v)} className={chip(contactMethod === m.v)}>
              {m.label}
            </button>
          ))}
        </div>
        <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactMethod === "LINE" ? "LINE ID" : "電話番号"} />
      </div>

      <div>
        <label className={label}>お名前</label>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
      </div>
      <div>
        <label className={label}>会社名（任意）</label>
        <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="◯◯自動車 株式会社" />
      </div>
      <div>
        <label className={label}>
          メールアドレス（{registeredBy === "SELF" ? "本人のマイページ用" : "任意"}）
        </label>
        <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <textarea className={`${field} min-h-24`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="備考・条件（年式/走行/色/希望条件など）" />

      {(localError || state.error) && <p className="text-sm text-red-400">{localError || state.error}</p>}

      <button type="submit" disabled={isPending} className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60">
        {isPending ? "登録中…" : "この内容で登録する"}
      </button>
    </form>
  );
}
