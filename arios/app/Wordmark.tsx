// ブランドのワードマーク（ARIOS ロゴ画像 + GARAGE）。ヘッダー用。
export default function Wordmark({
  align = "center",
}: {
  align?: "center" | "left";
}) {
  const wrap = align === "center" ? "items-center" : "items-start";
  const pad = align === "center" ? "pl-[0.5em]" : "";
  return (
    <div className={`flex flex-col ${wrap} gap-1.5`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-arios.png" alt="ARIOS" className="h-6 w-auto" />
      <span
        className={`text-[10px] font-medium tracking-[0.5em] text-muted ${pad}`}
      >
        GARAGE
      </span>
    </div>
  );
}
