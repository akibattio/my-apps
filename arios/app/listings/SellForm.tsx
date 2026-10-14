"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { submitSell, type ListingState } from "./actions";
import { resizeImage } from "./resize";
import { tr, type Lang } from "@/lib/i18n";

const MAX_PHOTOS = 20;

export default function SellForm({
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
  const PARTIES = [
    { v: "OWNER", label: t("sell_owner") },
    { v: "BROKER", label: t("sell_broker") },
    { v: "DEALER", label: t("sell_dealer") },
  ];
  const CONTACTS = [
    { v: "PHONE", label: t("phone") },
    { v: "LINE", label: t("lineId") },
  ];

  const [state, formAction, isPending] = useActionState<ListingState, FormData>(
    submitSell,
    {}
  );
  const [email, setEmail] = useState(defaultEmail ?? "");
  const loggedIn = !!defaultEmail;
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [party, setParty] = useState("OWNER");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [vin, setVin] = useState("");
  const [contactMethod, setContactMethod] = useState(defaultContactMethod || "PHONE");
  const [contact, setContact] = useState(defaultContact ?? "");
  const [name, setName] = useState(defaultName ?? "");
  const [company, setCompany] = useState(defaultCompany ?? "");
  const [message, setMessage] = useState("");

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
    setPreparing(true);
    previews.forEach((u) => URL.revokeObjectURL(u));
    const resized = await Promise.all(selected.map((f) => resizeImage(f)));
    setFiles(resized);
    setPreviews(resized.map((f) => URL.createObjectURL(f)));
    setPreparing(false);
  }

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
      setLocalError(lang === "en" ? "Please enter a valid email (required)." : "メールアドレス（必須）を正しく入力してください。");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("company", ""); // honeypot（人は空のまま）
    fd.set("partyType", party);
    fd.set("manufacturer", manufacturer);
    fd.set("model", model);
    fd.set("price", price);
    fd.set("vin", vin);
    fd.set("contactMethod", contactMethod);
    fd.set("contact", contact);
    fd.set("name", name);
    fd.set("company_name", company);
    fd.set("email", email);
    fd.set("message", message);
    for (const f of files) fd.append("photos", f);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> {t("required")}</span>;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className={label}>{t("sell_party")}</label>
        <div className="flex flex-wrap gap-2">
          {PARTIES.map((p) => (
            <button
              type="button"
              key={p.v}
              onClick={() => setParty(p.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                party === p.v ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
              }`}
            >
              {p.label}
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
        <label className={label}>{t("sell_price")}</label>
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="32000000" />
      </div>
      <div>
        <label className={label}>{t("sell_vin")}</label>
        <input className={field} value={vin} onChange={(e) => setVin(e.target.value)} placeholder="ZFF79ALA4J0231234" autoCapitalize="characters" />
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

      <textarea className={`${field} min-h-24`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("sell_memo_ph")} />

      <div>
        <label htmlFor="sell-photos" className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted">
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">{t("sell_photo_add")}</span>
        </label>
        <p className="mt-1.5 text-xs text-muted">{t("sell_photo_note")}</p>
        <input ref={inputRef} id="sell-photos" type="file" accept="image/*" multiple onChange={onFilesChange} className="hidden" />
        {preparing && <p className="mt-2 text-sm text-muted">…</p>}
        {previews.length > 0 && (
          <div className="mt-2 grid grid-cols-5 gap-2">
            {previews.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="" className="aspect-square w-full rounded-md object-cover" />
            ))}
          </div>
        )}
      </div>

      {(localError || state.error) && <p className="text-sm text-red-400">{localError || state.error}</p>}

      <button type="submit" disabled={isPending || preparing} className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60">
        {isPending ? t("form_submitting") : t("form_submit")}
      </button>
    </form>
  );
}
