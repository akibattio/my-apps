"use client";

import { useActionState, useState, startTransition } from "react";
import { submitBuy, type ListingState } from "./actions";
import { tr, type Lang } from "@/lib/i18n";

export default function BuyForm({
  lang = "ja",
  defaultEmail,
  defaultName,
  defaultCompany,
  defaultContact,
  defaultContactMethod,
}: {
  lang?: Lang;
  defaultEmail?: string;
  defaultName?: string;
  defaultCompany?: string;
  defaultContact?: string;
  defaultContactMethod?: string;
}) {
  const t = tr(lang);
  const en = lang === "en";
  const CONTACTS = [
    { v: "PHONE", label: t("phone") },
    { v: "LINE", label: t("lineId") },
  ];
  const MODIFIED = [
    { v: "", label: t("buy_mod_any") },
    { v: "なし", label: t("buy_mod_no") },
    { v: "あり", label: t("buy_mod_yes") },
  ];
  const CHANNELS = [
    { v: "LINE", label: "LINE" },
    { v: "WHATSAPP", label: "WhatsApp" },
    { v: "PHONE", label: en ? "Phone" : "電話" },
    { v: "REFERRAL", label: en ? "Referral" : "紹介" },
    { v: "OTHER", label: en ? "Other" : "その他" },
  ];

  const [state, formAction, isPending] = useActionState<ListingState, FormData>(
    submitBuy,
    {}
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const loggedIn = !!defaultEmail;

  const [channel, setChannel] = useState("LINE");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [accidentNG, setAccidentNG] = useState(false);
  const [color, setColor] = useState("");
  const [interior, setInterior] = useState("");
  const [modified, setModified] = useState("");
  const [options, setOptions] = useState("");
  const [contactMethod, setContactMethod] = useState(defaultContactMethod || "PHONE");
  const [contact, setContact] = useState(defaultContact ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [company, setCompany] = useState(defaultCompany ?? "");
  const [memo, setMemo] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!manufacturer.trim() || !model.trim()) {
      setLocalError(t("form_err_makermodel"));
      return;
    }
    if (!name.trim()) {
      setLocalError(t("signup_err_name"));
      return;
    }
    if (!contact.trim()) {
      setLocalError(t("signup_err_contact"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError(en ? "Please enter a valid email (required)." : "メールアドレス（必須）を正しく入力してください。");
      return;
    }
    setLocalError(null);
    // こだわり条件＋備考を message にまとめる（判定ロジック用に日本語マーカーは固定）
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
    fd.set("channel", channel);
    fd.set("manufacturer", manufacturer);
    fd.set("model", model);
    fd.set("price", price);
    fd.set("contactMethod", contactMethod);
    fd.set("contact", contact);
    fd.set("name", name);
    fd.set("company_name", company);
    fd.set("email", email);
    fd.set("message", message);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> {t("required")}</span>;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className={label}>{t("form_channel")}</label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              type="button"
              key={c.v}
              onClick={() => setChannel(c.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                channel === c.v ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={label}>{t("form_maker")}{req}</label>
        <input className={field} value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder={t("form_maker_ph")} />
      </div>
      <div>
        <label className={label}>{t("form_model")}{req}</label>
        <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("form_model_ph")} />
      </div>
      <div>
        <label className={label}>{t("buy_price")}</label>
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="30000000" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">{t("buy_pref")}</p>
        <label className="mb-3 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={accidentNG} onChange={(e) => setAccidentNG(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          {t("buy_accident")}
        </label>
        <div className="space-y-3">
          <input className={field} value={color} onChange={(e) => setColor(e.target.value)} placeholder={t("buy_color_ph")} />
          <input className={field} value={interior} onChange={(e) => setInterior(e.target.value)} placeholder={t("buy_interior_ph")} />
          <input className={field} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={t("buy_option_ph")} />
          <div>
            <span className={label}>{t("buy_mod")}</span>
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

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">{t("form_contact_block")}</p>
        <div className="space-y-3">
          <div>
            <label className={label}>{t("contact")}{req}</label>
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
            <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactMethod === "LINE" ? t("lineId") : t("phone")} />
          </div>
          <div>
            <label className={label}>{t("name")}{req}</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form_name_ph")} autoComplete="name" />
          </div>
          <div>
            <label className={label}>{t("company")}（{t("optional")}）</label>
            <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("form_company_ph")} autoComplete="organization" />
          </div>
          <div>
            <label className={label}>{t("email")}{req}</label>
            <input
              className={`${field} ${loggedIn ? "opacity-60" : ""}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={loggedIn}
              placeholder={t("form_email_ph")}
              autoComplete="email"
            />
          </div>
        </div>
      </div>

      <textarea className={`${field} min-h-24`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("buy_memo_ph")} />

      {(localError || state.error) && <p className="text-sm text-red-400">{localError || state.error}</p>}

      <button type="submit" disabled={isPending} className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60">
        {isPending ? t("form_submitting") : t("form_submit")}
      </button>
    </form>
  );
}
