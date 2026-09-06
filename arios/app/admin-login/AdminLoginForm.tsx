"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 管理者（ARIOS）専用ログイン。一般ユーザーの /login とは分離。
export default function AdminLoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError("メールアドレスまたはパスワードが違います。");
      return;
    }
    router.push("/admin");
    router.refresh();
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
        placeholder="管理者メールアドレス"
        autoComplete="email"
        className={field}
      />
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          autoComplete="current-password"
          className={`${field} pr-16`}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
        >
          {showPw ? "隠す" : "表示"}
        </button>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? "ログイン中…" : "管理者としてログイン"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
