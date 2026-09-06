// アプリのワードマーク。「LIFE LINE GARAGE」を主役に、ARIOSは小さくブランド表記。
export default function Wordmark({
  align = "center",
}: {
  align?: "center" | "left";
}) {
  const wrap = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <div className={`flex flex-col ${wrap} gap-1.5`}>
      {/* ブランド（ARIOS）ロゴは従来サイズ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-arios.png" alt="ARIOS" className="h-6 w-auto" />
      <div className="font-extrabold leading-[1.02] tracking-tight">
        <span className="block text-[30px] sm:text-[34px]">
          LIFE LINE <span className="text-primary">GARAGE</span>
        </span>
      </div>
    </div>
  );
}
