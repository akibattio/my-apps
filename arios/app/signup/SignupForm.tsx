"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/nav";
import { tr, type Lang } from "@/lib/i18n";
import { signUpCustomer } from "./actions";

// メール＋パスワードで新規登録。
export default function SignupForm({ lang = "ja" }: { lang?: Lang }) {
  const t = tr(lang);
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/mypage");

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 確認メール送信後の画面
  const [sent, setSent] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

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
    if (password.length < 6) {
      setError(t("signup_err_pw"));
      return;
    }
    setBusy(true);
    // サーバーで会員登録（プロフィールも保存）。Supabase の確認メール設定で挙動が変わる。
    const res = await signUpCustomer(email, password, {
      name,
      company,
      contact,
      contactMethod,
    });
    if (res.error === "ratelimited") {
      setBusy(false);
      setError(t("signup_err_rate"));
      return;
    }
    if (res.error === "exists") {
      setBusy(false);
      setError(t("signup_err_exists"));
      return;
    }
    if (res.error) {
      setBusy(false);
      setError(t("signup_err_failed"));
      return;
    }
    if (res.status === "confirm") {
      // 確認メール送信済み。確認するまでログインできない。
      setBusy(false);
      setSent(true);
      return;
    }
    // signedIn: サーバー側でセッション確立済み。マイページへ。
    router.push(next);
    router.refresh();
  }

  async function onResend() {
    setResendMsg(null);
    setResending(true);
    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/mypage` },
    });
    setResending(false);
    setResendMsg(t("vfy_resent"));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";

  const labelC = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> {t("required")}</span>;

  // 確認メール送信後の画面
  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="text-4xl">📧</div>
        <h2 className="text-lg font-semibold">{t("vfy_sent_title")}</h2>
        <p className="text-sm text-muted">
          <span className="text-foreground">{email}</span> {t("vfy_sent_body")}
        </p>
        <p className="text-xs text-muted">{t("vfy_sent_note")}</p>
        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="w-full rounded-full border border-neutral-700 px-6 py-3 text-sm text-foreground disabled:opacity-60"
        >
          {resending ? t("vfy_resending") : t("vfy_resend")}
        </button>
        {resendMsg && <p className="text-sm text-accent">{resendMsg}</p>}
        <p>
          <Link
            href={next !== "/mypage" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            {t("vfy_open_login")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelC}>{t("name")}{req}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("form_name_ph")} autoComplete="name" className={field} />
      </div>
      <div>
        <label className={labelC}>{t("company")}（{t("optional")}）</label>
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("form_company_ph")} autoComplete="organization" className={field} />
      </div>
      <div>
        <label className={labelC}>{t("contact")}{req}</label>
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
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactMethod === "LINE" ? t("lineId") : t("phone")} className={field} />
      </div>
      <div>
        <label className={labelC}>{t("email")}{req}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("form_email_ph")}
          autoComplete="email"
          className={field}
        />
      </div>
      <div>
        <label className={labelC}>{t("password")}{req}</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("signup_pw_ph")}
            autoComplete="new-password"
            className={`${field} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
          >
            {showPw ? t("login_hide") : t("login_show")}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? t("signup_doing") : t("signup_do")}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-center text-sm text-muted">
        {t("signup_have")}{" "}
        <Link
          href={next !== "/mypage" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-accent underline-offset-4 hover:underline"
        >
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
