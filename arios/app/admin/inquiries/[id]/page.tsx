import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateInquiryStatus } from "../actions";
import { STATUS_LABEL, SOURCE_LABEL } from "../constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "依頼の詳細 — ARIOS GARAGE" };

const BUCKET = "inquiry-photos";
const FLOW = ["NEW", "IN_PROGRESS", "DONE", "ARCHIVED"] as const;

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: inq } = await supabase
    .from("inquiries")
    .select(
      "id, name, contact, contact_method, vehicle_text, message, photo_urls, status, source, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!inq) notFound();

  // 非公開バケットの写真は署名付きURLで一時表示
  let signed: string[] = [];
  const paths: string[] = inq.photo_urls ?? [];
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    signed = (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
  }

  const rows: [string, string | null][] = [
    ["顧客名", inq.name],
    ["連絡先", inq.contact],
    [
      "受付方法",
      SOURCE_LABEL[inq.contact_method || inq.source] ||
        inq.contact_method ||
        inq.source,
    ],
    ["車について", inq.vehicle_text],
  ];

  return (
    <div>
      <header className="mb-6 flex items-center gap-3">
        <Link href="/admin/inquiries" className="text-muted" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">依頼の詳細</h1>
        <span className="ml-auto rounded-full border border-border bg-white/5 px-3 py-1 text-xs text-muted">
          {STATUS_LABEL[inq.status] ?? inq.status}
        </span>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[6rem_1fr] gap-2">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="text-sm text-foreground">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        {inq.message && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-1 text-sm text-muted">内容・メモ</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {inq.message}
            </p>
          </div>
        )}
      </section>

      {signed.length > 0 && (
        <section className="mb-6">
          <p className="mb-2 text-sm text-muted">添付写真</p>
          <div className="grid grid-cols-3 gap-2">
            {signed.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm text-muted">ステータスを変更</p>
        <div className="flex flex-wrap gap-2">
          {FLOW.map((s) => (
            <form key={s} action={updateInquiryStatus}>
              <input type="hidden" name="id" value={inq.id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                disabled={s === inq.status}
                className={`rounded-full border px-4 py-2 text-sm ${
                  s === inq.status
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-neutral-700 text-muted hover:text-foreground"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            </form>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        受付: {new Date(inq.created_at).toLocaleString("ja-JP")}
        {inq.updated_at !== inq.created_at && (
          <> ／ 更新: {new Date(inq.updated_at).toLocaleString("ja-JP")}</>
        )}
      </p>
    </div>
  );
}
