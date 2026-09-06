import Wordmark from "../Wordmark";

export const metadata = { title: "送信ありがとうございます — LIFE LINE GARAGE" };

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const isBuy = kind === "BUY";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Wordmark />
      <div className="mt-8 text-5xl text-accent">✓</div>
      <h1 className="mt-5 text-2xl font-semibold">送信ありがとうございます</h1>
      <p className="mt-3 leading-relaxed text-muted">
        {isBuy
          ? "お探しの条件を受け付けました。売り手が見つかり次第、ARIOSよりご連絡します。"
          : "お車の情報を受け付けました。買い手が見つかり次第、ARIOSよりご連絡します。"}
      </p>
    </main>
  );
}
