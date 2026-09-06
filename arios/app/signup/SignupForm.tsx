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

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("お名前（必須）を入力してください。");
      return;
    }
    if (!contact.trim()) {
      setError("連絡先（電話番号 または LINE ID・必須）を入力してください。");
      return;
    }
    if (password.length < 6) {
      setError("パスワードは6文字以上にしてください。");
      return;
    }
    setBusy(true);
    // 1) サーバーで確認済みユーザーを作成（プロフィールも保存）
    const res = await signUpCustomer(email, password, {
      name,
      company,
      contact,
      contactMethod,
    });
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

  const labelC = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> 必須</span>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelC}>お名前{req}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" autoComplete="name" className={field} />
      </div>
      <div>
        <label className={labelC}>会社名（任意）</label>
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="◯◯自動車 株式会社" autoComplete="organization" className={field} />
      </div>
      <div>
        <label className={labelC}>連絡先{req}</label>
        <div className="mb-2 flex gap-2">
          {[
            { v: "PHONE", label: "電話番号" },
            { v: "LINE", label: "LINE ID" },
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
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactMethod === "LINE" ? "LINE ID" : "電話番号"} className={field} />
      </div>
      <div>
        <label className={labelC}>メールアドレス{req}</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={field}
        />
      </div>
      <div>
        <label className={labelC}>パスワード{req}</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6文字以上"
            autoComplete="new-password"
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
      </div>
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
