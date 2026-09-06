import Link from "next/link";

// アプリのワードマーク。「LIFE LINE GARAGE」を主役に、ARIOSは小さくブランド表記。
// クリックでトップ（/）へ戻る。
export default function Wordmark({
  align = "center",
}: {
  align?: "center" | "left";
}) {
  const wrap = align === "center" ? "items-center text-center" : "items-start text-left";
  return (
    <Link href="/" aria-label="トップへ戻る" className={`flex flex-col ${wrap} gap-1.5`}>
      {/* ブランド（ARIOS）ロゴは従来サイズ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-arios.png" alt="ARIOS" className="h-10 w-auto" />
      <div
        className="font-semibold italic leading-[1.02] tracking-tight"
        style={{ fontFamily: "var(--font-brand), system-ui, sans-serif" }}
      >
        <span className="block text-[27px] sm:text-[30.6px]">
          LIFE LINE <span className="text-primary">GARAGE</span>
        </span>
      </div>
    </Link>
  );
}
