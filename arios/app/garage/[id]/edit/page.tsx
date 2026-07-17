import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import EditVehicleForm from "./EditVehicleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "登録内容を編集 — ARIOS" };

export default async function EditVehiclePage({
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
    .select("id, manufacturer, model, year")
    .eq("id", id)
    .maybeSingle();
  if (!vehicle) notFound();

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Link href={`/garage/${id}`} className="text-muted" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-xl font-semibold">登録内容を編集</h1>
      </header>

      <EditVehicleForm
        vehicleId={id}
        initial={{
          manufacturer: vehicle.manufacturer ?? "",
          model: vehicle.model ?? "",
          year: vehicle.year ? String(vehicle.year) : "",
        }}
      />
    </main>
  );
}
