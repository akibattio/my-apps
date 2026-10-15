import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ProfileForm from "./ProfileForm";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "登録情報の編集 — LIFE LINE GARAGE" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mypage/profile");
  const lang = await getLang();
  const t = tr(lang);
  const meta = (user.user_metadata ?? {}) as {
    name?: string;
    company?: string;
    contact?: string;
    contact_method?: string;
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/mypage" className="text-sm text-accent">
        {t("back_mypage")}
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-semibold">{t("profile_title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("profile_sub")}</p>
      </header>

      <ProfileForm
        lang={lang}
        initial={{
          name: meta.name ?? "",
          company: meta.company ?? "",
          contact: meta.contact ?? "",
          contactMethod: meta.contact_method ?? "PHONE",
        }}
      />

      <p className="mt-6 text-xs text-muted">
        {user.email} — {t("profile_email_note")}
      </p>
    </main>
  );
}
