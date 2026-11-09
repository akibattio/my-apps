"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Cloudflare Turnstile（CAPTCHA）の表示部品。
// NEXT_PUBLIC_TURNSTILE_SITE_KEY が設定されたときだけ呼び出し元で描画する。
// トークンは onToken で親に渡し、サインアップのサーバーアクションへ送る。

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export default function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    function render() {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      if (!document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = SCRIPT_SRC;
        s.async = true;
        s.defer = true;
        s.onload = render;
        document.head.appendChild(s);
      }
      poll = setInterval(() => {
        if (window.turnstile) {
          if (poll) clearInterval(poll);
          render();
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [siteKey, onToken]);

  return <div ref={ref} className="my-1" />;
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// フォーム用: トークンの保持と、使い終わったトークンの作り直し（トークンは1回しか使えない）。
// Supabase Auth で CAPTCHA を有効にすると、登録・ログイン・再設定・確認メール再送のすべてで必要になる。
export function useCaptcha() {
  const [token, setToken] = useState("");
  const [nonce, setNonce] = useState(0);
  const onToken = useCallback((t: string) => setToken(t), []);
  const reset = useCallback(() => {
    setToken("");
    setNonce((n) => n + 1);
  }, []);
  const widget = TURNSTILE_SITE_KEY ? (
    <Turnstile key={nonce} siteKey={TURNSTILE_SITE_KEY} onToken={onToken} />
  ) : null;
  return {
    enabled: !!TURNSTILE_SITE_KEY,
    token,
    // 有効なのにまだ確認が済んでいない
    missing: !!TURNSTILE_SITE_KEY && !token,
    reset,
    widget,
  };
}

// Supabase の CAPTCHA 検証エラーかどうか。
export function isCaptchaError(e: { message?: string; code?: string } | null | undefined): boolean {
  if (!e) return false;
  return (e.code ?? "").includes("captcha") || (e.message ?? "").toLowerCase().includes("captcha");
}
