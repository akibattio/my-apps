import Link from "next/link";

export const metadata = { title: "登録ありがとうございます — ARIOS" };

// Thank You。登録直後に表示し、作った車の Timeline への導線を出す。
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl text-accent">✓</div>
      <h1 className="mt-6 text-2xl font-semibold">登録ありがとうございます</h1>
      <p className="mt-3 leading-relaxed text-muted">
        この車のTimelineが始まりました。
        <br />
        ここから歴史を積み重ねていけます。
      </p>

      {v ? (
        <Link
          href={`/passport/${v}`}
          className="mt-10 rounded-full bg-accent px-8 py-4 font-medium text-black"
        >
          Timelineを見る
        </Link>
      ) : (
        <Link href="/" className="mt-10 text-accent">
          トップへ
        </Link>
      )}
    </main>
  );
}
