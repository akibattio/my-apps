"use client";

import { useState } from "react";
import { tr, type Lang } from "@/lib/i18n";

// 売りたい登録の「区分・車体番号・オーナー本人の確認」を編集画面でも変更できるようにする。
export default function SellGateFields({
  lang,
  partyType,
  vin,
  ownerConsent,
  ownerName,
}: {
  lang: Lang;
  partyType: string | null;
  vin: string | null;
  ownerConsent: boolean;
  ownerName: string | null;
}) {
  const t = tr(lang);
  const [party, setParty] = useState(partyType ?? "");
  const isAgent = party === "BROKER" || party === "DEALER";
  const PARTIES = [
    { v: "OWNER", label: t("sell_owner") },
    { v: "BROKER", label: t("sell_broker") },
    { v: "DEALER", label: t("sell_dealer") },
  ];
  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> {t("required")}</span>;

  return (
    <>
      <div>
        <label className={label}>{t("sell_party")}{req}</label>
        <input type="hidden" name="partyType" value={party} />
        <div className="flex flex-wrap gap-2">
          {PARTIES.map((p) => (
            <button
              type="button"
              key={p.v}
              onClick={() => setParty(p.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                party === p.v ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {isAgent && (
          <div className="mt-3 space-y-3 rounded-2xl border border-accent/40 bg-accent/[0.05] p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="ownerConsent"
                defaultChecked={ownerConsent}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
              />
              <span>
                {t("sell_consent")}
                <span className="text-red-400"> {t("required")}</span>
              </span>
            </label>
            <div>
              <label className={label}>{t("sell_owner_name")}{req}</label>
              <input className={field} name="ownerName" defaultValue={ownerName ?? ""} autoComplete="off" />
              <p className="mt-1.5 text-xs text-muted">{t("sell_owner_name_note")}</p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className={label}>{t("sell_vin")}{req}</label>
        <input
          className={field}
          name="vin"
          defaultValue={vin ?? ""}
          placeholder={t("sell_vin_ph")}
          autoCapitalize="characters"
          autoComplete="off"
        />
      </div>
    </>
  );
}
