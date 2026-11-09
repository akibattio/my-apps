import Link from "next/link";
import { redirect } from "next/navigation";
import Wordmark from "../Wordmark";
import LangToggle from "../LangToggle";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_ACTIVE } from "@/app/admin/inquiries/constants";
import { carKey, canonicalMaker } from "@/lib/carname";
import { getLang } from "@/lib/lang";
import { tr } from "@/lib/i18n";
import { pageTitle } from "@/lib/meta";

// 会員限定: いま登録されている車を「車名だけ」で見せる（鈴木さん依頼 2026-11-07）。
// 写真・車体番号・所在地・価格・登録者は出さない。他にも車を持っている会員が
// 「うちにもある」と気づいて登録してくれるための一覧。
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return pageTitle("登録されている車", "Cars on LIFE LINE GARAGE");
}

type Car = { maker: string; model: string; count: number };

function group(rows: { manufacturer: string | null; model: string | null }[]): Car[] {
  const m = new Map<string, Car>();
  for (const r of rows) {
    const model = (r.model ?? "").trim();
    if (!(r.manufacturer ?? "").trim() || !model) continue;
    const k = carKey(r.manufacturer, r.model);
    const g = m.get(k);
    if (g) g.count++;
    else m.set(k, { maker: canonicalMaker(r.manufacturer), model, count: 1 });
  }
  return [...m.values()].sort(
    (a, b) => a.maker.localeCompare(b.maker) || a.model.localeCompare(b.model)
  );
}

function CarSection({
  title,
  note,
  cars,
  href,
  cta,
  tone,
  empty,
}: {
  title: string;
  note: string;
  cars: Car[];
  href: string;
  cta: string;
  tone: string;
  empty: string;
}) {
  const q = (c: Car) => `maker=${encodeURIComponent(c.maker)}&model=${encodeURIComponent(c.model)}`;
  return (
    <section className="mt-8">
      <h2 className={`text-base font-semibold ${tone}`}>
        {title}
        <span className="ml-2 text-xs font-normal text-muted">{cars.length}</span>
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">{note}</p>
      {cars.length === 0 ? (
        <p className="mt-3 rounded-xl border border-border bg-card p-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {cars.map((c) => (
            <li key={c.maker + "|" + c.model} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{c.maker}</span>
                <span className="block truncate text-sm font-medium">{c.model}</span>
              </span>
              {c.count > 1 && <span className="text-xs text-muted">×{c.count}</span>}
              <Link
                href={`${href}?${q(c)}`}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
              >
                {cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function CarsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cars");
  const lang = await getLang();
  const t = tr(lang);

  // 車名（メーカー・車種）だけを取得する。ほかの列は読まない。
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("inquiries")
    .select("kind, manufacturer, model")
    .in("status", STATUS_ACTIVE);
  const rows = data ?? [];
  const wanted = group(rows.filter((r) => r.kind === "BUY"));
  const forSale = group(rows.filter((r) => r.kind === "SELL"));

  return (
    <main className="mx-auto max-w-xl px-6 pt-10 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-accent hover:underline">
          ‹ {t("backTop")}
        </Link>
        <LangToggle lang={lang} />
      </div>
      <header className="flex flex-col items-center text-center">
        <Wordmark />
        <h1 className="mt-5 text-2xl font-semibold">{t("cars_title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t("cars_lead")}</p>
      </header>

      <CarSection
        title={t("cars_wanted")}
        note={t("cars_wanted_note")}
        cars={wanted}
        href="/sell"
        cta={t("cars_cta_sell")}
        tone="text-sky-400"
        empty={t("cars_empty")}
      />
      <CarSection
        title={t("cars_forsale")}
        note={t("cars_forsale_note")}
        cars={forSale}
        href="/buy"
        cta={t("cars_cta_buy")}
        tone="text-accent"
        empty={t("cars_empty")}
      />

      <p className="mt-10 text-center text-xs leading-relaxed text-muted">{t("cars_privacy")}</p>
    </main>
  );
}
