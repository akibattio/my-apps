import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { throwIfDbError } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "車両 — LIFE LINE GARAGE" };

type Row = {
  id: string;
  vin: string | null;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  source: string | null;
  is_public: boolean;
  created_at: string;
  owner: { name: string | null } | { name: string | null }[] | null;
};

const SOURCE_LABEL: Record<string, string> = {
  SELL_LISTING: "売りたい登録",
  MEMBER: "会員",
  ADMIN: "運営",
};

function ownerName(owner: Row["owner"]): string {
  const o = Array.isArray(owner) ? owner[0] : owner;
  return o?.name ?? "—";
}

// 車体番号ごとの車の記録の一覧。
export default async function AdminVehicles() {
  const admin = createAdminClient();
  const [{ data, error }, { data: listings, error: lErr }, { data: claims, error: cErr }] =
    await Promise.all([
      admin
        .from("vehicles")
        .select("id, vin, manufacturer, model, year, source, is_public, created_at, owner:current_owner_id(name)")
        .order("created_at", { ascending: false }),
      admin.from("inquiries").select("vehicle_id").eq("kind", "SELL").not("vehicle_id", "is", null),
      admin.from("vehicle_claims").select("vehicle_id").eq("status", "PENDING"),
    ]);
  throwIfDbError(error ?? lErr ?? cErr, "admin/vehicles");

  const rows = (data ?? []) as Row[];
  const count = (list: { vehicle_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const r of list ?? []) if (r.vehicle_id) m.set(r.vehicle_id, (m.get(r.vehicle_id) ?? 0) + 1);
    return m;
  };
  const listingCount = count(listings);
  const claimCount = count(claims);

  return (
    <div>
      <h1 className="text-xl font-semibold">車両（{rows.length}）</h1>
      <p className="mt-1 mb-6 text-xs text-muted">
        車体番号ごとに1件。売りたい登録は車体番号で自動的にここへつながります。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-muted">
              <th className="py-2 pr-4 font-normal">車両</th>
              <th className="py-2 pr-4 font-normal">車体番号</th>
              <th className="py-2 pr-4 font-normal">持ち主</th>
              <th className="py-2 pr-4 font-normal">売りたい</th>
              <th className="py-2 pr-4 font-normal">出どころ</th>
              <th className="py-2 font-normal">登録日</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-neutral-900">
                <td className="py-2 pr-4">
                  <Link href={`/admin/vehicles/${v.id}`} className="text-accent hover:underline">
                    {[v.manufacturer, v.model].filter(Boolean).join(" ") || "名称未設定"}
                  </Link>
                  {v.year ? <span className="text-muted"> · {v.year}</span> : null}
                  {(claimCount.get(v.id) ?? 0) > 0 && (
                    <span className="ml-2 rounded-full bg-amber-900/50 px-2 py-0.5 text-[11px] text-amber-200">
                      持ち主確認待ち
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{v.vin ?? "—"}</td>
                <td className="py-2 pr-4">{ownerName(v.owner)}</td>
                <td className="py-2 pr-4 tabular-nums">{listingCount.get(v.id) ?? 0}</td>
                <td className="py-2 pr-4 text-muted">{v.source ? SOURCE_LABEL[v.source] ?? v.source : "—"}</td>
                <td className="py-2 tabular-nums text-muted">{v.created_at.slice(0, 10)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  まだ車両がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
