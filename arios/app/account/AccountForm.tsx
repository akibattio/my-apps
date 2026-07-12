"use client";

import { useActionState } from "react";
import { updateProfile, type AccountState } from "./actions";

export default function AccountForm({ initialName }: { initialName: string }) {
  const [state, formAction, isPending] = useActionState<AccountState, FormData>(
    updateProfile,
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm text-muted">表示名</label>
      <input
        name="name"
        type="text"
        defaultValue={initialName}
        maxLength={60}
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground"
      />
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-accent">保存しました。</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-neutral-700 px-6 py-3 text-sm font-medium text-foreground disabled:opacity-60"
      >
        {isPending ? "保存中…" : "表示名を保存"}
      </button>
    </form>
  );
}
