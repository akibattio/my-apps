"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/nav";
import { tr, type Lang } from "@/lib/i18n";

// メール＋パスワードでログイン。
export default function LoginForm({ lang = "ja" }: { lang?: Lang }) {
  const t = tr(lang);
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/mypage");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // メール未確認のとき確認メール再送を促す
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMsg(null);
    setUnconfirmed(false);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      const code = (error as { code?: string }).code ?? "";
      const msg = (error.message ?? "").toLowerCase();
      if (code === "email_not_confirmed" || msg.includes("not confirmed") || msg.includes("confirm")) {
        setUnconfirmed(true);
        setError(t("login_unconfirmed"));
        return;
      }
      setError(t("login_err"));
      return;
    }
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("email")}
        autoComplete="email"
        className={field}
      />
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          autoComplete="current-password"
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
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? t("login_doing") : t("login")}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {unconfirmed && (
        <div className="space-y-1 text-center">
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="text-sm text-accent underline-offset-4 hover:underline disabled:opacity-60"
          >
            {resending ? t("vfy_resending") : t("login_resend")}
          </button>
          {resendMsg && <p className="text-sm text-accent">{resendMsg}</p>}
        </div>
      )}
      <p className="text-center text-sm">
        <Link href="/forgot" className="text-muted underline-offset-4 hover:underline">
          {t("login_forgot")}
        </Link>
      </p>
      <p className="text-center text-sm text-muted">
        {t("login_first")}{" "}
        <Link
          href={next !== "/mypage" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="text-accent underline-offset-4 hover:underline"
        >
          {t("signup")}
        </Link>
      </p>
    </form>
  );
}
