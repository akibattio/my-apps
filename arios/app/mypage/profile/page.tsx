import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "登録情報の編集 — LIFE LINE GARAGE" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage/profile");
  const meta = (user.user_metadata ?? {}) as {
    name?: string;
    company?: string;
    contact?: string;
    contact_method?: string;
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/mypage" className="text-sm text-accent">
        ‹ マイページへ
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-semibold">登録情報の編集</h1>
        <p className="mt-1 text-sm text-muted">
          お名前・会社名・連絡先を変更できます。次回の登録フォームにも反映されます。
        </p>
      </header>

      <ProfileForm
        initial={{
          name: meta.name ?? "",
          company: meta.company ?? "",
          contact: meta.contact ?? "",
          contactMethod: meta.contact_method ?? "PHONE",
        }}
      />

      <p className="mt-6 text-xs text-muted">
        メールアドレス（{user.email}）はログインIDのため、ここでは変更できません。変更が必要な場合はARIOSまでご連絡ください。
      </p>
    </main>
  );
}
