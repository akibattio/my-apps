"use client";

import { useActionState } from "react";
import { updateVehicle, type EditVehicleState } from "./actions";
import { tr, type Lang } from "@/lib/i18n";

export default function EditVehicleForm({
  vehicleId,
  initial,
  lang = "ja",
}: {
  lang?: Lang;
  vehicleId: string;
  initial: { manufacturer: string; model: string; year: string };
}) {
  const t = tr(lang);
  const [state, formAction, isPending] = useActionState<EditVehicleState, FormData>(
    updateVehicle,
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input
        name="manufacturer"
        type="text"
        defaultValue={initial.manufacturer}
        placeholder={`${t("form_maker")}（${t("form_maker_ph")}）`}
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />
      <input
        name="model"
        type="text"
        defaultValue={initial.model}
        placeholder={`${t("form_model")}（${t("form_model_ph")}）`}
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />
      <input
        name="year"
        type="number"
        inputMode="numeric"
        defaultValue={initial.year}
        placeholder={`${t("reg_year")}（${t("reg_year_ph")}）`}
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {isPending ? t("ev_saving") : t("ev_save")}
      </button>
      <p className="text-center text-xs text-muted">
        {t("ev_note")}
      </p>
    </form>
  );
}
