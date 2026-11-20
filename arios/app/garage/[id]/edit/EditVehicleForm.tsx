"use client";

import { useActionState } from "react";
import { updateVehicle, type EditVehicleState } from "./actions";
import { tr, type Lang } from "@/lib/i18n";
import MakerOptions, { MAKER_LIST_ID } from "@/app/listings/MakerOptions";

export type VehicleProfile = {
  manufacturer: string;
  model: string;
  year: string;
  exteriorColor: string;
  interiorColor: string;
  appealPoints: string;
  factoryOptions: string;
  accidentHistory: string; // "YES" | "NO" | "UNKNOWN" | ""
};

// 車の基本情報とプロフィールの編集フォーム。どの項目も空のままでよい。
export default function EditVehicleForm({
  vehicleId,
  initial,
  lang = "ja",
}: {
  lang?: Lang;
  vehicleId: string;
  initial: VehicleProfile;
}) {
  const t = tr(lang);
  const [state, formAction, isPending] = useActionState<EditVehicleState, FormData>(updateVehicle, {});
  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const opt = t("optional_paren");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="vehicleId" value={vehicleId} />

      <div>
        <label className={label}>{t("form_maker")}</label>
        <input name="manufacturer" defaultValue={initial.manufacturer} placeholder={t("form_maker_ph")} list={MAKER_LIST_ID} autoComplete="off" maxLength={60} className={field} />
        <MakerOptions lang={lang} />
      </div>
      <div>
        <label className={label}>{t("form_model")}</label>
        <input name="model" defaultValue={initial.model} placeholder={t("form_model_ph")} maxLength={100} className={field} />
      </div>
      <div>
        <label className={label}>{t("reg_year")}{opt}</label>
        <input name="year" inputMode="numeric" defaultValue={initial.year} placeholder={t("reg_year_ph")} maxLength={4} className={field} />
      </div>

      <h2 className="pt-3 text-sm font-semibold tracking-wide">{t("vp_title")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t("vp_exterior")}{opt}</label>
          <input name="exteriorColor" defaultValue={initial.exteriorColor} placeholder={t("vp_exterior_ph")} maxLength={60} className={field} />
        </div>
        <div>
          <label className={label}>{t("vp_interior")}{opt}</label>
          <input name="interiorColor" defaultValue={initial.interiorColor} placeholder={t("vp_interior_ph")} maxLength={60} className={field} />
        </div>
      </div>
      <div>
        <label className={label}>{t("vp_appeal")}{opt}</label>
        <textarea name="appealPoints" defaultValue={initial.appealPoints} placeholder={t("vp_appeal_ph")} maxLength={2000} className={`${field} min-h-24`} />
      </div>
      <div>
        <label className={label}>{t("vp_options")}{opt}</label>
        <textarea name="factoryOptions" defaultValue={initial.factoryOptions} placeholder={t("vp_options_ph")} maxLength={2000} className={`${field} min-h-20`} />
      </div>
      <fieldset>
        <legend className={label}>{t("vp_accident")}{opt}</legend>
        <div className="flex flex-wrap gap-2">
          {["YES", "NO", "UNKNOWN"].map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm has-[:checked]:border-accent has-[:checked]:text-accent">
              <input type="radio" name="accidentHistory" value={v} defaultChecked={initial.accidentHistory === v} className="sr-only" />
              {t(`vp_accident_${v}`)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t("vp_accident_note")}</p>
      </fieldset>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60"
      >
        {isPending ? t("ev_saving") : t("ev_save")}
      </button>
      <p className="text-center text-xs text-muted">{t("ev_note")}</p>
    </form>
  );
}
