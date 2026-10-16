"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { tr, type Lang } from "@/lib/i18n";

// パスワード再設定メールの送信。送信結果は（メールアドレスの存在を漏らさないため）
// 常に「送信しました」と表示する。
export default function ForgotForm({ lang = "ja" }: { lang?: Lang }) {
  const t = tr(lang);
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // 再設定リンクの戻り先。/auth/callback がセッションを確立して新パスワード設定画面へ。
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
    });
    setBusy(false);
    setSent(true);
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">📧</div>
        <p className="text-sm text-muted">{t("fp_sent")}</p>
      </div>
    );
  }

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
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? t("fp_sending") : t("fp_send")}
      </button>
    </form>
  );
}
