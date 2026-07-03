"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// メールでログイン（パスワード不要）。メールに届く6桁コードを入力して確定する。
export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError("コードの送信に失敗しました。メールアドレスを確認してください。");
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError("コードが正しくないか、期限切れです。もう一度お試しください。");
      return;
    }
    router.push("/garage");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4">
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
            {busy ? "送信中…" : "ログインコードを送る"}
          </button>
          <p className="text-center text-xs text-muted">
            初めての方はそのまま登録されます。パスワードは不要です。
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm text-muted">
            {email} に届いた6桁のコードを入力してください。
          </p>
          <input
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6桁のコード"
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-center text-lg tracking-[0.4em] text-foreground placeholder:text-neutral-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-accent px-6 py-4 font-medium text-black disabled:opacity-60"
          >
            {busy ? "確認中…" : "ログイン"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-xs text-muted"
          >
            メールアドレスを変更する
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
