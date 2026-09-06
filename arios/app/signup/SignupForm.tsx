"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUpCustomer } from "./actions";

// メール＋パスワードで新規登録。
// サーバー側で「確認済みユーザー」を作成 → クライアントでログイン → マイページへ。
// （確認メールを送らないので、メール配信が未整備でも登録できる）
export default function SignupForm() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") ?? "/mypage";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/mypage";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("パスワードは6文字以上にしてください。");
      return;
    }
    setBusy(true);
    // 1) サーバーで確認済みユーザーを作成
    const res = await signUpCustomer(email, password);
    if (res.error === "exists") {
      setBusy(false);
      setError("このメールアドレスは既に登録されています。ログインしてください。");
      return;
    }
    if (res.error) {
      setBusy(false);
      setError("登録に失敗しました。入力内容を確認してください。");
      return;
    }
    // 2) 作成できたらそのままログイン
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setError("登録は完了しました。お手数ですがログインしてください。");
      return;
    }
    router.push(next);
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
