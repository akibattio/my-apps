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

// 成立可能性のあるマッチ数 = 有効な依頼をメーカー×車種でまとめ、
// 買い手も売り手もいるグループの数。マッチング一覧の isMatch と同じ考え方。
async function countPotentialMatches(
  admin: ReturnType<typeof createAdminClient>
): Promise<number | null> {
  try {
    const { data, error } = await admin
      .from("inquiries")
      .select("kind, manufacturer, model")
      .in("status", STATUS_ACTIVE);
    if (error) return null;
    const groups = new Map<string, { buy: boolean; sell: boolean }>();
    for (const r of data ?? []) {
      const maker = (r.manufacturer ?? "").trim().toLowerCase();
      const model = (r.model ?? "").trim().toLowerCase();
      if (!maker && !model) continue;
      const key = maker + "||" + model;
      const g = groups.get(key) ?? { buy: false, sell: false };
      if (r.kind === "BUY") g.buy = true;
      else g.sell = true;
      groups.set(key, g);
    }
    let n = 0;
    for (const g of groups.values()) if (g.buy && g.sell) n++;
    return n;
  } catch {
    return null;
  }
}

// 取引(成立/進行中)の件数。
async function dealCount(
  admin: ReturnType<typeof createAdminClient>
): Promise<number | null> {
  try {
    const { count, error } = await admin
      .from("deals")
      .select("*", { count: "exact", head: true })
      .in("status", ["IN_PROGRESS", "CLOSED"]);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const admin = createAdminClient();
  const [
    vehicles,
    owners,
    histories,
    documents,
    images,
    analyses,
    buyCount,
    sellCount,
    potentialMatches,
    deals,
  ] = await Promise.all([
    count(admin, "vehicles"),
    count(admin, "owners"),
    count(admin, "histories"),
    count(admin, "documents"),
    count(admin, "images"),
    count(admin, "ai_analyses"),
    kindCount(admin, "BUY"),
    kindCount(admin, "SELL"),
    countPotentialMatches(admin),
    dealCount(admin),
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
        href="/admin/new"
        className="mb-3 flex items-center justify-between rounded-2xl border border-primary/50 bg-primary/10 p-5 hover:border-primary"
      >
        <div>
          <p className="text-sm font-semibold text-primary">＋ 依頼を登録（代理登録OK）</p>
          <p className="mt-1 text-xs text-muted">
            電話・LINE・来店で受けた買いたい/売りたいを登録（AI下書きも可）
          </p>
        </div>
        <span className="text-primary">›</span>
      </Link>

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
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link
          href="/admin/matching"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-accent"
        >
          <div>
            <p className="text-sm">🔗 マッチング</p>
            <p className="mt-1 text-xs text-muted">成立可能性のあるマッチ</p>
          </div>
          <span className="flex items-center gap-1">
            <span className="text-2xl font-semibold tabular-nums text-accent">
              {potentialMatches ?? "—"}
            </span>
            <span className="text-xs text-muted">件</span>
          </span>
        </Link>
        <Link
          href="/admin/deals"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:border-emerald-400"
        >
          <div>
            <p className="text-sm">🤝 取引</p>
            <p className="mt-1 text-xs text-muted">成立・進行中の取引</p>
          </div>
          <span className="flex items-center gap-1">
            <span className="text-2xl font-semibold tabular-nums text-emerald-300">
              {deals ?? "—"}
            </span>
            <span className="text-xs text-muted">件</span>
          </span>
        </Link>
      </div>

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
