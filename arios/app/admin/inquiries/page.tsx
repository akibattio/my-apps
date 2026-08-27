import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_LABEL } from "./constants";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  NEW: "text-accent border-accent/40 bg-accent/10",
  IN_PROGRESS: "text-primary border-primary/40 bg-primary/10",
  DONE: "text-muted border-border bg-white/5",
  ARCHIVED: "text-muted border-border bg-white/5",
};

export default async function InquiriesPage() {
  const supabase = createAdminClient();
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, name, contact, vehicle_text, message, status, created_at")
    .order("created_at", { ascending: false });

  const list = inquiries ?? [];
  const openCount = list.filter((i) => i.status === "NEW" || i.status === "IN_PROGRESS").length;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">依頼インボックス</h1>
          <p className="mt-1 text-sm text-muted">未対応 {openCount} 件 / 全 {list.length} 件</p>
        </div>
        <Link
          href="/admin/inquiries/new"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-black"
        >
          ＋ 依頼を登録
        </Link>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ依頼がありません。
          <br />
          「＋ 依頼を登録」から、電話・LINE・来店で受けた相談を記録しましょう。
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => {
            const snippet =
              [i.vehicle_text, i.message].filter(Boolean).join(" / ") || "（内容未記入）";
            return (
              <li key={i.id}>
                <Link
                  href={`/admin/inquiries/${i.id}`}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 active:border-accent/40"
                >
                  <span
                    className={`flex-none rounded-full border px-2.5 py-1 text-[11px] ${
                      STATUS_STYLE[i.status] ?? STATUS_STYLE.DONE
                    }`}
                  >
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {i.name || "名称未設定"}
                      {i.contact ? (
                        <span className="ml-2 text-xs font-normal text-muted">{i.contact}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{snippet}</span>
                  </span>
                  <span className="flex-none text-xs text-muted">
                    {new Date(i.created_at).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
