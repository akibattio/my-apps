import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { updateMyListing } from "../../actions";
import { KIND_LABEL } from "@/app/admin/inquiries/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "情報を編集 — LIFE LINE GARAGE" };

type Row = {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  message: string | null;
  contact: string | null;
  name: string | null;
  email: string | null;
};

export default async function EditMyListing({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/mypage/${id}/edit`);
  const email = (user.email ?? "").toLowerCase();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select("id, kind, manufacturer, model, price, message, contact, name, email")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const r = data as Row;
  // 本人以外は自分のマイページへ戻す。
  if ((r.email ?? "").toLowerCase() !== email) redirect("/mypage");

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/mypage" className="text-sm text-accent">
        ‹ マイページへ
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-semibold">情報を編集</h1>
        <p className="mt-1 text-sm text-muted">
          {KIND_LABEL[r.kind] ?? r.kind}：{r.manufacturer} {r.model}
        </p>
      </header>

      <form action={updateMyListing} className="space-y-5">
        <input type="hidden" name="id" value={r.id} />
        <div>
          <label className={label}>{r.kind === "SELL" ? "販売価格（円）" : "希望価格（円）"}</label>
          <input
            className={field}
            name="price"
            defaultValue={r.price ?? ""}
            inputMode="numeric"
            placeholder="例: 12000000"
          />
        </div>
        <div>
          <label className={label}>連絡先</label>
          <input className={field} name="contact" defaultValue={r.contact ?? ""} placeholder="電話番号 / LINE ID" />
        </div>
        <div>
          <label className={label}>お名前・会社名</label>
          <input className={field} name="name" defaultValue={r.name ?? ""} placeholder="任意" />
        </div>
        <div>
          <label className={label}>備考・希望条件</label>
          <textarea
            className={`${field} min-h-28`}
            name="message"
            defaultValue={r.message ?? ""}
            placeholder="状態・年式・希望条件など"
          />
        </div>
        <p className="text-xs text-muted">
          ※ メーカー・車種の変更が必要な場合は、お手数ですが新しく登録し直してください。
        </p>
        <button
          type="submit"
          className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
        >
          保存する
        </button>
      </form>
    </main>
  );
}
