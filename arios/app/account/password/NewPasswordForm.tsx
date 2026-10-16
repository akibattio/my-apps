"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tr, type Lang } from "@/lib/i18n";

// 新しいパスワードを設定する（再設定メールのリンク経由で確立したセッションで更新）。
export default function NewPasswordForm({ lang = "ja" }: { lang?: Lang }) {
  const t = tr(lang);
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t("np_err_pw"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      setError(t("np_err"));
      return;
    }
    setBusy(false);
    setDone(true);
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="text-4xl">✅</div>
        <p className="text-sm text-muted">{t("np_done")}</p>
        <button
          type="button"
          onClick={() => {
            router.push("/mypage");
            router.refresh();
          }}
          className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black"
        >
          {t("np_to_mypage")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("np_ph")}
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
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? t("np_saving") : t("np_save")}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
