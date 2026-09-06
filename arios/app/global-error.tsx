"use client";

// ルートレイアウト自体が壊れたときの最終フォールバック。
// ここは layout を置き換えるため、Tailwind ではなくインラインスタイルで最小構成にする。
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
          padding: "0 24px",
          background: "#0b0b0c",
          color: "#f5f3ee",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif',
          textAlign: "center",
        }}
      >
        <p style={{ letterSpacing: "0.4em", fontSize: "12px", color: "#c8a24a", margin: 0 }}>
          LIFE LINE GARAGE
        </p>
        <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
          一時的なエラーが発生しました
        </h1>
        <p style={{ fontSize: "14px", color: "#a8a29a", lineHeight: 1.7, margin: 0 }}>
          少し時間をおいて、もう一度お試しください。
        </p>
        <button
          onClick={reset}
          style={{
            border: "none",
            borderRadius: "999px",
            padding: "12px 32px",
            fontWeight: 700,
            color: "#1a1407",
            background: "#ffc61a",
          }}
        >
          再読み込み
        </button>
        {error?.digest && (
          <p style={{ fontSize: "10px", color: "#6b6b70", margin: 0 }}>
            エラーID: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
