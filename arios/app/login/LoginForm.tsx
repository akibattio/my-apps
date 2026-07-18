"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// メールでログイン（パスワード不要）。
// 送られてくるメールのリンクをタップすると /auth/callback 経由でログインする。
export default function LoginForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/garage`,
      },
    });
    setBusy(false);
    if (error) {
      setError("送信に失敗しました。メールアドレスを確認して、もう一度お試しください。");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground">
          {email} に<span className="text-accent">ログイン用リンク</span>を送りました。
        </p>
        <p className="text-sm leading-relaxed text-muted">
          メールを開いて、中のリンク（ボタン）をタップするとログインできます。
          届かない場合は、迷惑メールフォルダもご確認ください。
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
          className="text-sm text-muted underline-offset-4 hover:underline"
        >
          別のメールアドレスで送り直す
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        autoComplete="email"
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? "送信中…" : "ログインリンクを送る"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-center text-xs text-muted">
        初めての方はそのまま登録されます。パスワードは不要です。
      </p>
    </form>
  );
}
