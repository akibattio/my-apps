import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { updateMyListing } from "../../actions";
import ListingPhotos from "./ListingPhotos";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";

const BUCKET = "inquiry-photos";

export const dynamic = "force-dynamic";
export const metadata = { title: "情報を編集 — LIFE LINE GARAGE" };

type Row = {
  id: string;
  kind: string;
  manufacturer: string | null;
  model: string | null;
  price: number | null;
  message: string | null;
  contact: string | null;
  name: string | null;
  auth_user_id: string | null;
  photo_urls: string[] | null;
};

export default async function EditMyListing({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/mypage/${id}/edit`);
  const lang = await getLang();
  const t = tr(lang);

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select("id, kind, manufacturer, model, price, message, contact, name, auth_user_id, photo_urls")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const r = data as Row;
  // 本人以外（認証ユーザーID不一致）は自分のマイページへ戻す。
  if (r.auth_user_id !== user.id) redirect("/mypage");

  // 既存写真は非公開バケットなので署名付きURLで表示。
  const paths: string[] = r.photo_urls ?? [];
  let photos: { path: string; url: string }[] = [];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    photos = paths.map((p, i) => ({ path: p, url: signed?.[i]?.signedUrl ?? "" })).filter((x) => x.url);
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/mypage" className="text-sm text-accent">
        {t("back_mypage")}
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-semibold">{t("edit_title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {(r.kind === "SELL" ? t("tab_sell") : t("tab_buy"))}：{r.manufacturer} {r.model}
        </p>
      </header>

      <form action={updateMyListing} className="space-y-5">
        <input type="hidden" name="id" value={r.id} />
        <div>
          <label className={label}>{t("form_maker")}<span className="text-red-400"> {t("required")}</span></label>
          <input className={field} name="manufacturer" defaultValue={r.manufacturer ?? ""} placeholder={t("form_maker_ph")} />
        </div>
        <div>
          <label className={label}>{t("form_model")}<span className="text-red-400"> {t("required")}</span></label>
          <input className={field} name="model" defaultValue={r.model ?? ""} placeholder={t("form_model_ph")} />
        </div>
        <div>
          <label className={label}>{r.kind === "SELL" ? t("edit_price_sell") : t("edit_price_buy")}</label>
          <input
            className={field}
            name="price"
            defaultValue={r.price ?? ""}
            inputMode="numeric"
            placeholder="12000000"
          />
        </div>
        <div>
          <label className={label}>{t("contact")}</label>
          <input className={field} name="contact" defaultValue={r.contact ?? ""} placeholder={lang === "en" ? "Phone / LINE ID" : "電話番号 / LINE ID"} />
        </div>
        <div>
          <label className={label}>{t("edit_name_company")}</label>
          <input className={field} name="name" defaultValue={r.name ?? ""} placeholder={t("optional")} />
        </div>
        <div>
          <label className={label}>{t("edit_memo")}</label>
          <textarea
            className={`${field} min-h-28`}
            name="message"
            defaultValue={r.message ?? ""}
            placeholder={t("edit_memo_ph")}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black"
        >
          {t("save")}
        </button>
      </form>

      {r.kind === "SELL" && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium">{t("photos")}</h2>
          <ListingPhotos id={r.id} photos={photos} lang={lang} />
        </section>
      )}
    </main>
  );
}
