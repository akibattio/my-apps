"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tr, type Lang } from "@/lib/i18n";

// 個人情報（お名前・会社名・連絡先）の編集。ログイン中の本人の user_metadata を更新する。
export default function ProfileForm({
  initial,
  lang = "ja",
}: {
  initial: { name: string; company: string; contact: string; contactMethod: string };
  lang?: Lang;
}) {
  const t = tr(lang);
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [company, setCompany] = useState(initial.company);
  const [contactMethod, setContactMethod] = useState(initial.contactMethod || "PHONE");
  const [contact, setContact] = useState(initial.contact);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("signup_err_name"));
      return;
    }
    if (!contact.trim()) {
      setError(t("signup_err_contact"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        name: name.trim(),
        company: company.trim() || null,
        contact: contact.trim(),
        contact_method: contactMethod,
      },
    });
    if (error) {
      setBusy(false);
      setError(lang === "en" ? "Failed to save. Please try again later." : "保存に失敗しました。時間をおいてお試しください。");
      return;
    }
    router.push("/mypage");
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> {t("required")}</span>;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className={label}>{t("name")}{req}</label>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form_name_ph")} />
      </div>
      <div>
        <label className={label}>{t("company")}（{t("optional")}）</label>
        <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("form_company_ph")} />
      </div>
      <div>
        <label className={label}>{t("contact")}{req}</label>
        <div className="mb-2 flex gap-2">
          {[
            { v: "PHONE", label: t("phone") },
            { v: "LINE", label: t("lineId") },
          ].map((m) => (
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60"
      >
        {busy ? (lang === "en" ? "Saving…" : "保存中…") : t("save")}
      </button>
    </form>
  );
}
