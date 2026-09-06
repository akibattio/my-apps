// アプリのワードマーク。「LIFE LINE GARAGE」を主役に、ARIOSは小さくブランド表記。
export default function Wordmark({
  align = "center",
}: {
  align?: "center" | "left";
}) {
  const wrap = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <div className={`flex flex-col ${wrap} gap-1.5`}>
      {/* ブランド（ARIOS）は控えめに上に添える */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-arios.png" alt="ARIOS" className="h-3.5 w-auto opacity-70" />
      <div className="font-extrabold leading-[1.02] tracking-tight">
        <span className="block text-[27px] sm:text-[30px]">
          LIFE LINE <span className="text-primary">GARAGE</span>
        </span>
      </div>
    </div>
  );
}
