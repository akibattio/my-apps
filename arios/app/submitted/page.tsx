import Link from "next/link";
import Wordmark from "../Wordmark";
import { getCurrentUser } from "@/lib/auth";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

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
  const lang = await getLang();
  const t = tr(lang);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Wordmark />
      <div className="mt-8 text-5xl text-accent">✓</div>
      <h1 className="mt-5 text-2xl font-semibold">{t("done_title")}</h1>
      <p className="mt-3 leading-relaxed text-muted">
        {isBuy ? t("done_buy") : t("done_sell")}
      </p>

      <div className="mt-8 w-full space-y-3">
        {user ? (
          <>
            <Link
              href="/mypage"
              className="block w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
            >
              {t("done_mypage")}
            </Link>
            <Link
              href={isBuy ? "/buy" : "/sell"}
              className="block w-full rounded-full border border-border px-6 py-3 text-sm"
            >
              {t("done_more")}
            </Link>
          </>
        ) : (
          <Link
            href="/"
            className="block w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
          >
            {t("backTop")}
          </Link>
        )}
      </div>
    </main>
  );
}
