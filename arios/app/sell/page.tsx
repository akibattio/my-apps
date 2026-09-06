import Wordmark from "../Wordmark";
import SellForm from "../listings/SellForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "車を売りたい — ARIOS GARAGE",
  description: "お車の情報をご登録ください。ARIOSが買い手をお探しします。",
};

export default async function SellPage() {
  const user = await getCurrentUser();
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <Wordmark />
        <p className="mt-3 pl-[0.5em] text-[10px] tracking-[0.5em] text-accent">LIFE LINE</p>
        <h1 className="mt-5 text-2xl font-semibold">車を売りたい方へ</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          お車の情報をご登録ください。ARIOSが買い手をお探しします。
        </p>
      </header>
      <SellForm defaultEmail={user?.email ?? undefined} />
    </main>
  );
}
