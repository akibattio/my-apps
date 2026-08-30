import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateInquiryStatus,
  linkInquiryToVehicle,
  saveFollowup,
  markContacted,
} from "../actions";
import { STATUS_LABEL, PARTY_LABEL, KIND_LABEL, STATUS_FLOW } from "../constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "依頼の詳細 — ARIOS GARAGE" };

const BUCKET = "inquiry-photos";

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
      "id, kind, manufacturer, model, price, vin, party_type, name, contact, contact_method, vehicle_text, message, photo_urls, status, source, vehicle_id, next_action_date, last_contact_at, note, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!inq) notFound();

  // 紐付け済み車両の名前を取得
  let linkedVehicle: { id: string; name: string } | null = null;
  if (inq.vehicle_id) {
    const { data: v } = await supabase
      .from("vehicles")
      .select("id, manufacturer, model")
      .eq("id", inq.vehicle_id)
      .maybeSingle();
    if (v) {
      linkedVehicle = {
        id: v.id,
        name:
          [v.manufacturer, v.model].filter(Boolean).join(" ") || "名称未設定の車両",
      };
    }
  }

  // 非公開バケットの写真は署名付きURLで一時表示
  let signed: string[] = [];
  const paths: string[] = inq.photo_urls ?? [];
  if (paths.length > 0) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    signed = (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
  }

  const contactMethodLabel =
    inq.contact_method === "LINE"
      ? "LINE ID"
      : inq.contact_method === "PHONE"
        ? "電話番号"
        : "連絡先";

  const rows: [string, string | null][] = [
    ["種別", inq.kind ? KIND_LABEL[inq.kind] ?? inq.kind : null],
    ["メーカー", inq.manufacturer],
    ["車種", inq.model],
    [
      inq.kind === "BUY" ? "希望価格" : "販売価格",
      inq.price != null ? "¥" + Number(inq.price).toLocaleString("ja-JP") : null,
    ],
    ["区分", inq.party_type ? PARTY_LABEL[inq.party_type] ?? inq.party_type : null],
    [contactMethodLabel, inq.contact],
    ["お名前・会社名", inq.name],
    ["車体番号", inq.vin],
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
        <p className="mb-3 text-sm text-muted">フォロー（取りこぼさない）</p>

        {/* ステータス */}
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_FLOW.map((s) => (
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

        {/* 最終接触 + 連絡した */}
        <div className="mb-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted">
            最終接触:{" "}
            {inq.last_contact_at
              ? new Date(inq.last_contact_at).toLocaleString("ja-JP")
              : "未"}
          </span>
          <form action={markContacted}>
            <input type="hidden" name="id" value={inq.id} />
            <button
              type="submit"
              className="rounded-full border border-accent px-4 py-2 text-sm text-accent"
            >
              連絡した（今）
            </button>
          </form>
        </div>

        {/* 次アクション日 + メモ */}
        <form action={saveFollowup} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="id" value={inq.id} />
          <div>
            <label className="mb-1 block text-sm text-muted">次にやること・いつ追う</label>
            <input
              type="date"
              name="nextActionDate"
              defaultValue={inq.next_action_date ?? ""}
              className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">フォローメモ</label>
            <textarea
              name="note"
              defaultValue={inq.note ?? ""}
              placeholder="例: 来週価格交渉。相手はオーナー本人確認済み。"
              className="min-h-20 w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-black"
          >
            フォローを保存
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-sm text-muted">車両との連携</p>
        {linkedVehicle ? (
          <Link
            href={`/garage/${linkedVehicle.id}`}
            className="flex items-center justify-between rounded-xl border border-border p-3"
          >
            <span className="text-sm">🚗 {linkedVehicle.name} の記録を見る</span>
            <span className="text-muted">›</span>
          </Link>
        ) : (
          <form action={linkInquiryToVehicle}>
            <input type="hidden" name="id" value={inq.id} />
            <button
              type="submit"
              className="w-full rounded-full bg-primary px-6 py-3 font-semibold text-black"
            >
              この依頼を車両として登録する
            </button>
            <p className="mt-2 text-xs text-muted">
              依頼の写真・内容を引き継いで車両の記録を作成します（あとから編集・整備履歴の追加ができます）。
            </p>
          </form>
        )}
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
