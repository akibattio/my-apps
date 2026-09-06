"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// メール＋パスワードで新規登録。
// Supabase の「メール確認(Confirm email)」がオフなら即ログイン→マイページへ。
// オンの場合はセッションが張られないので「確認メールを見てください」を表示する。
export default function SignupForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/mypage";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/mypage";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needConfirm, setNeedConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("パスワードは6文字以上にしてください。");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setBusy(false);
      setError(
        error.message.includes("already")
          ? "このメールアドレスは既に登録されています。ログインしてください。"
          : "登録に失敗しました。入力内容を確認してください。"
      );
      return;
    }
    // セッションがあればそのままログイン、無ければメール確認待ち
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      setBusy(false);
      setNeedConfirm(true);
    }
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";

  if (needConfirm) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed">
          {email} に<span className="text-accent">確認メール</span>を送りました。
        </p>
        <p className="text-sm leading-relaxed text-muted">
          メール内のリンクを開くと登録が完了します。完了後に
          <Link href="/login" className="text-accent">
            ログイン
          </Link>
          してください。
        </p>
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
        placeholder="メールアドレス"
        autoComplete="email"
        className={field}
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード（6文字以上）"
        autoComplete="new-password"
        className={field}
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {busy ? "登録中…" : "登録する"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-center text-sm text-muted">
        既にアカウントをお持ちの方は{" "}
        <Link
          href={next !== "/mypage" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-accent underline-offset-4 hover:underline"
        >
          ログイン
        </Link>
      </p>
    </form>
  );
}
