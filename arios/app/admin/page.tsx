import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE } from "./inquiries/constants";

export const dynamic = "force-dynamic";

async function count(
  admin: ReturnType<typeof createAdminClient>,
  table: string
): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

// inquiries テーブルが未作成でも落ちないよう安全に件数を取る。
async function kindCount(
  admin: ReturnType<typeof createAdminClient>,
  kind: string
): Promise<number | null> {
  try {
    const { count, error } = await admin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("kind", kind)
      .in("status", STATUS_ACTIVE);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const admin = createAdminClient();
  const [vehicles, owners, histories, documents, images, analyses, buyCount, sellCount] =
    await Promise.all([
      count(admin, "vehicles"),
      count(admin, "owners"),
      count(admin, "histories"),
      count(admin, "documents"),
      count(admin, "images"),
      count(admin, "ai_analyses"),
      kindCount(admin, "BUY"),
      kindCount(admin, "SELL"),
    ]);

  const stats = [
    { label: "車両", value: vehicles, href: "/admin/vehicles" },
    { label: "オーナー", value: owners, href: "/admin/owners" },
    { label: "履歴(Timeline)", value: histories },
    { label: "書類", value: documents },
    { label: "写真", value: images },
    { label: "AI解析", value: analyses },
  ];

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Link
          href="/admin/buyers"
          className="rounded-2xl border border-sky-400/40 bg-sky-400/10 p-5 hover:border-sky-400"
        >
          <p className="text-sm text-sky-300">🔵 買いたい人</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{buyCount ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">いつ・誰から・どんな車</p>
        </Link>
        <Link
          href="/admin/sellers"
          className="rounded-2xl border border-accent/40 bg-accent/10 p-5 hover:border-accent"
        >
          <p className="text-sm text-accent">🟡 売りたい人</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{sellCount ?? "—"}</p>
          <p className="mt-1 text-xs text-muted">車ごと・区分・人数</p>
        </Link>
      </div>
      <Link
        href="/admin/matching"
        className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-accent"
      >
        <p className="text-sm">🔗 マッチング（メーカー×車種で突き合わせ）</p>
        <span className="text-accent">›</span>
      </Link>

      <h1 className="mb-6 text-xl font-semibold">サマリー</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const card = (
            <div className="rounded-xl border border-neutral-800 p-5">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:border-accent">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>
      <p className="mt-8 text-sm text-muted">
        全運用データの一覧です。車両・オーナーはカードから詳細一覧へ。
        AIレビュー・信頼度・取引などの管理機能は今後追加します。
      </p>
    </div>
  );
}
