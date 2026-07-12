import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  status: string | null;
  created_at: string;
  owner: { name: string | null } | { name: string | null }[] | null;
};

function ownerName(owner: Row["owner"]): string {
  const o = Array.isArray(owner) ? owner[0] : owner;
  return o?.name ?? "—";
}

export default async function AdminVehicles() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vehicles")
    .select("id, manufacturer, model, year, status, created_at, owner:current_owner_id(name)")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">車両（{rows.length}）</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-muted">
              <th className="py-2 pr-4 font-normal">車両</th>
              <th className="py-2 pr-4 font-normal">年式</th>
              <th className="py-2 pr-4 font-normal">オーナー</th>
              <th className="py-2 pr-4 font-normal">登録日</th>
              <th className="py-2 font-normal">公開</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-neutral-900">
                <td className="py-2 pr-4">
                  {[v.manufacturer, v.model].filter(Boolean).join(" ") || "名称未設定"}
                </td>
                <td className="py-2 pr-4 tabular-nums">{v.year ?? "—"}</td>
                <td className="py-2 pr-4">{ownerName(v.owner)}</td>
                <td className="py-2 pr-4 tabular-nums text-muted">
                  {v.created_at.slice(0, 10)}
                </td>
                <td className="py-2">
                  <Link href={`/passport/${v.id}`} className="text-accent">
                    見る
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
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
