"use client";

import { useActionState, useState, startTransition } from "react";
import { submitBuy, type ListingState } from "./actions";

const CONTACTS = [
  { v: "PHONE", label: "電話番号" },
  { v: "LINE", label: "LINE ID" },
];
const MODIFIED = [
  { v: "", label: "不問" },
  { v: "なし", label: "改造なし" },
  { v: "あり", label: "改造あり" },
];

export default function BuyForm() {
  const [state, formAction, isPending] = useActionState<ListingState, FormData>(
    submitBuy,
    {}
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  // こだわり条件
  const [accidentNG, setAccidentNG] = useState(false);
  const [color, setColor] = useState("");
  const [interior, setInterior] = useState("");
  const [modified, setModified] = useState("");
  const [options, setOptions] = useState("");
  // 連絡先ほか
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!manufacturer.trim() || !model.trim()) {
      setLocalError("メーカーと車種（必須）を入力してください。");
      return;
    }
    setLocalError(null);
    // こだわり条件＋備考を message にまとめる
    const message = [
      accidentNG ? "事故車NG" : null,
      color.trim() ? `カラー: ${color.trim()}` : null,
      interior.trim() ? `内装色: ${interior.trim()}` : null,
      modified ? `改造: ${modified}` : null,
      options.trim() ? `オプション: ${options.trim()}` : null,
      memo.trim() ? `備考: ${memo.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" / ");

    const fd = new FormData();
    fd.set("company", ""); // honeypot
    fd.set("manufacturer", manufacturer);
    fd.set("model", model);
    fd.set("price", price);
    fd.set("contactMethod", contactMethod);
    fd.set("contact", contact);
    fd.set("name", name);
    fd.set("message", message);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> 必須</span>;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className={label}>メーカー{req}</label>
        <input className={field} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="例: フェラーリ" />
      </div>
      <div>
        <label className={label}>車種{req}</label>
        <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder="例: 488 Pista" />
      </div>
      <div>
        <label className={label}>希望価格（円・任意）</label>
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="例: 30000000" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">こだわり条件（任意）</p>
        <label className="mb-3 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={accidentNG} onChange={(e) => setAccidentNG(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          事故車はNG
        </label>
        <div className="space-y-3">
          <input className={field} value={color} onChange={(e) => setColor(e.target.value)} placeholder="ボディカラー（例: 赤 / 白）" />
          <input className={field} value={interior} onChange={(e) => setInterior(e.target.value)} placeholder="内装色（例: 黒 / タン）" />
          <input className={field} value={options} onChange={(e) => setOptions(e.target.value)} placeholder="希望オプション（例: サンルーフ / カーボン）" />
          <div>
            <span className={label}>改造</span>
            <div className="flex gap-2">
              {MODIFIED.map((m) => (
                <button
                  type="button"
                  key={m.label}
                  onClick={() => setModified(m.v)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    modified === m.v ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className={label}>連絡先</label>
        <div className="mb-2 flex gap-2">
          {CONTACTS.map((m) => (
            <button
              type="button"
              key={m.v}
              onClick={() => setContactMethod(m.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                contactMethod === m.v ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactMethod === "LINE" ? "LINE ID" : "電話番号"} />
      </div>

      <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="お名前・会社名（任意）" />
      <textarea className={`${field} min-h-24`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="その他ご希望・備考（任意）" />

      {(localError || state.error) && <p className="text-sm text-red-400">{localError || state.error}</p>}

      <button type="submit" disabled={isPending} className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60">
        {isPending ? "送信中…" : "この内容で送信する"}
      </button>
    </form>
  );
}
