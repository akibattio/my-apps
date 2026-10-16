"use client";

import { useEffect, useRef } from "react";

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
