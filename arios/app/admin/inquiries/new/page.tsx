import Link from "next/link";
import NewInquiryForm from "./NewInquiryForm";

export const metadata = { title: "依頼を登録 — ARIOS GARAGE" };

export default function NewInquiryPage() {
  return (
    <div>
      <header className="mb-6 flex items-center gap-3">
        <Link href="/admin/inquiries" className="text-muted" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">依頼を登録</h1>
      </header>
      <NewInquiryForm />
    </div>
  );
}
