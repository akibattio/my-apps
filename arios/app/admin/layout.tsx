import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理 — LIFE LINE GARAGE" };

// 管理者エリアのゲート。管理者(メール許可リスト)以外はトップへ。
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin-login");

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-5 pb-16 pt-6">
      <p className="text-xs tracking-[0.35em] text-accent">ARIOS ADMIN</p>
      <AdminNav />
      {children}
    </div>
  );
}
