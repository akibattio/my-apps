"use client";

import { useActionState } from "react";
import { updateVehicle, type EditVehicleState } from "./actions";

export default function EditVehicleForm({
  vehicleId,
  initial,
}: {
  vehicleId: string;
  initial: { manufacturer: string; model: string; year: string };
}) {
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
        placeholder="メーカー（例: トヨタ）"
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />
      <input
        name="model"
        type="text"
        defaultValue={initial.model}
        placeholder="モデル（例: スープラ）"
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />
      <input
        name="year"
        type="number"
        inputMode="numeric"
        defaultValue={initial.year}
        placeholder="年式（例: 1994）"
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-accent px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {isPending ? "保存中…" : "変更を保存する"}
      </button>
      <p className="text-center text-xs text-muted">
        変更内容は記録に残ります（ARIOSは履歴を消しません）。
      </p>
    </form>
  );
}
