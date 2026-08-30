import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_LABEL, KIND_LABEL, STATUS_ACTIVE } from "./constants";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  NEW: "text-accent border-accent/40 bg-accent/10",
  CONTACTED: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  NEGOTIATING: "text-primary border-primary/40 bg-primary/10",
  CLOSED: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  DROPPED: "text-muted border-border bg-white/5",
};

export default async function InquiriesPage() {
  const supabase = createAdminClient();
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, kind, manufacturer, model, price, name, contact, message, status, created_at")
    .order("created_at", { ascending: false });

  const list = inquiries ?? [];
  const openCount = list.filter((i) => STATUS_ACTIVE.includes(i.status)).length;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">登録一覧</h1>
          <p className="mt-1 text-sm text-muted">未対応 {openCount} 件 / 全 {list.length} 件</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/buy" className="rounded-full border border-border px-4 py-2 text-muted">
            ＋買いたい
          </Link>
          <Link href="/sell" className="rounded-full bg-primary px-4 py-2 font-semibold text-black">
            ＋売りたい
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted">
          まだ登録がありません。
          <br />
          「＋売りたい」「＋買いたい」から登録、または公開フォームのURLを共有してください。
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => {
            const kind = KIND_LABEL[i.kind] ?? i.kind;
            const carName = [i.manufacturer, i.model].filter(Boolean).join(" ");
            const priceLabel = i.price != null ? "¥" + Number(i.price).toLocaleString("ja-JP") : null;
            const snippet =
              [priceLabel, i.name, i.message].filter(Boolean).join(" / ") || "（内容未記入）";
            return (
              <li key={i.id}>
                <Link
                  href={`/admin/inquiries/${i.id}`}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 active:border-accent/40"
                >
                  <span
                    className={`flex-none rounded-full border px-2.5 py-1 text-[11px] ${
                      STATUS_STYLE[i.status] ?? STATUS_STYLE.DROPPED
                    }`}
                  >
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      <span
                        className={`mr-2 rounded px-1.5 py-0.5 text-[10px] ${
                          i.kind === "BUY"
                            ? "bg-sky-400/15 text-sky-300"
                            : "bg-accent/15 text-accent"
                        }`}
                      >
                        {kind}
                      </span>
                      {carName || "車種未設定"}
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
