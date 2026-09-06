import Link from "next/link";
import Wordmark from "../Wordmark";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "送信ありがとうございます — LIFE LINE GARAGE" };

export default async function SubmittedPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const isBuy = kind === "BUY";
  const user = await getCurrentUser();

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

      <div className="mt-8 w-full space-y-3">
        {user ? (
          <>
            <Link
              href="/mypage"
              className="block w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
            >
              マイページに戻る
            </Link>
            <Link
              href={isBuy ? "/buy" : "/sell"}
              className="block w-full rounded-full border border-border px-6 py-3 text-sm"
            >
              続けて登録する
            </Link>
          </>
        ) : (
          <Link
            href="/"
            className="block w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
          >
            トップに戻る
          </Link>
        )}
      </div>
    </main>
  );
}
