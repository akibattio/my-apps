import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import AddHistoryForm from "./AddHistoryForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "出来事を追加 — ARIOS" };

export default async function AddHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 本人が所有する車か（RLS）
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) notFound();

  const name =
    [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") || "この車";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Link href={`/garage/${id}`} className="text-muted" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">出来事を追加</h1>
      </header>
      <p className="mb-6 text-sm text-muted">{name} のTimelineに記録します。</p>

      <AddHistoryForm vehicleId={id} today={today} />
    </main>
  );
}
