"use client";

import { useActionState, useRef, useState } from "react";
import { addDocument, type AddDocumentState } from "./actions";
import { tr, fill, type Lang } from "@/lib/i18n";

const MAX_FILES = 10;
const TYPES = ["REGISTRATION", "SERVICE_RECORD", "INVOICE", "CONTRACT", "OTHER"];

export default function AddDocumentForm({ vehicleId, lang = "ja" }: { vehicleId: string; lang?: Lang }) {
  const tt = tr(lang);
  const [state, formAction, isPending] = useActionState<AddDocumentState, FormData>(
    addDocument,
    {}
  );
  const [type, setType] = useState("REGISTRATION");
  const [names, setNames] = useState<string[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > MAX_FILES) {
      setTooMany(true);
      setNames([]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setTooMany(false);
    setNames(files.map((f) => f.name));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="documentType" value={type} />

      {/* 種類 */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={
              "rounded-full px-4 py-2 text-sm " +
              (type === v
                ? "bg-primary font-medium text-black"
                : "border border-neutral-700 text-muted")
            }
          >
            {tt(`dt_${v}`)}
          </button>
        ))}
      </div>

      {/* ファイル */}
      <div>
        <label
          htmlFor="files"
          className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted"
        >
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">{fill(tt("ad_choose"), { n: MAX_FILES })}</span>
        </label>
        <input
          ref={inputRef}
          id="files"
          name="files"
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={onFilesChange}
          className="hidden"
        />
        {tooMany && (
          <p className="mt-2 text-sm text-red-400">
            {fill(tt("ad_too_many"), { n: MAX_FILES })}
          </p>
        )}
        {names.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {names.map((n, i) => (
              <li key={i}>・{n}</li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted">
        {tt("ad_note")}
      </p>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-primary px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {isPending ? tt("ad_submitting") : tt("ad_submit")}
      </button>
    </form>
  );
}
