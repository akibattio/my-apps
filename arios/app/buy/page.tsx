import Wordmark from "../Wordmark";
import BuyForm from "../listings/BuyForm";

export const metadata = {
  title: "車を探したい — ARIOS GARAGE",
  description: "お探しの車をご登録ください。ARIOSが売り手をお探しします。",
};

export default function BuyPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <header className="mb-8 flex flex-col items-center text-center">
        <Wordmark />
        <p className="mt-3 pl-[0.5em] text-[10px] tracking-[0.5em] text-accent">LIFE LINE</p>
        <h1 className="mt-5 text-2xl font-semibold">車を探したい方へ</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          お探しの車を1台ずつご登録ください。ARIOSが売り手をお探しします。
        </p>
      </header>
      <BuyForm />
    </main>
  );
}
