import QuickAddForm from "./QuickAddForm";

export const metadata = { title: "依頼を登録 — LIFE LINE GARAGE" };

export default function AdminNewPage() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">依頼を登録（代理登録OK）</h1>
        <p className="mt-1 text-sm text-muted">
          電話・LINE・来店などで受けた「買いたい/売りたい」を管理者が登録できます。
          写真・スクショ・貼り付けからAIで下書きも可能。
        </p>
      </header>
      <QuickAddForm />
    </div>
  );
}
