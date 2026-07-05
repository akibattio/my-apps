import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import AddDocumentForm from "./AddDocumentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "書類を追加 — ARIOS" };

export default async function AddDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, manufacturer, model")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) notFound();

  const name =
    [vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ") || "この車";

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Link href={`/garage/${id}`} className="text-muted" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">書類を追加</h1>
      </header>
      <p className="mb-6 text-sm text-muted">
        {name} の車検証・整備記録などを保管します（非公開）。
      </p>

      <AddDocumentForm vehicleId={id} />
    </main>
  );
}
