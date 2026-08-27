import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function count(
  admin: ReturnType<typeof createAdminClient>,
  table: string
): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

// inquiries テーブルが未作成でも落ちないよう安全に未対応件数を取る。
async function openInquiryCount(
  admin: ReturnType<typeof createAdminClient>
): Promise<number | null> {
  try {
    const { count, error } = await admin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .in("status", ["NEW", "IN_PROGRESS"]);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const admin = createAdminClient();
  const [vehicles, owners, histories, documents, images, analyses, openInquiries] =
    await Promise.all([
      count(admin, "vehicles"),
      count(admin, "owners"),
      count(admin, "histories"),
      count(admin, "documents"),
      count(admin, "images"),
      count(admin, "ai_analyses"),
      openInquiryCount(admin),
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
      <Link
        href="/admin/inquiries"
        className="mb-6 flex items-center justify-between rounded-2xl border border-accent/40 bg-accent/10 p-5 hover:border-accent"
      >
        <div>
          <p className="text-sm text-accent">📮 依頼インボックス</p>
          <p className="mt-1 text-sm text-muted">
            {openInquiries === null
              ? "テーブル未作成です（0004のSQLを実行してください）"
              : `未対応 ${openInquiries} 件 — 電話・LINE・来店の相談を記録`}
          </p>
        </div>
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
