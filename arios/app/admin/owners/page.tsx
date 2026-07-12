import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminOwners() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("owners")
    .select("id, name, email, owner_type, created_at")
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">オーナー（{rows.length}）</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-muted">
              <th className="py-2 pr-4 font-normal">名前 / 表示名</th>
              <th className="py-2 pr-4 font-normal">メール</th>
              <th className="py-2 pr-4 font-normal">種別</th>
              <th className="py-2 font-normal">登録日</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-b border-neutral-900">
                <td className="py-2 pr-4">{o.name ?? "—"}</td>
                <td className="py-2 pr-4 text-muted">{o.email ?? "—"}</td>
                <td className="py-2 pr-4 text-muted">{o.owner_type ?? "—"}</td>
                <td className="py-2 tabular-nums text-muted">
                  {o.created_at.slice(0, 10)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  まだオーナーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
