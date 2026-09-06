import QuickAddForm from "./QuickAddForm";

export const metadata = { title: "AIで登録 — LIFE LINE GARAGE" };

export default function AdminNewPage() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">AIで登録</h1>
        <p className="mt-1 text-sm text-muted">
          受け取った「買いたい/売りたい」を、写真・スクショ・貼り付けからAIで下書き→確認して登録。
        </p>
      </header>
      <QuickAddForm />
    </div>
  );
}
