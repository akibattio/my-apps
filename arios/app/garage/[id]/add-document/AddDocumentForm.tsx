"use client";

import { useActionState, useRef, useState } from "react";
import { addDocument, type AddDocumentState } from "./actions";

const MAX_FILES = 10;
const TYPES = [
  { value: "REGISTRATION", label: "車検証" },
  { value: "SERVICE_RECORD", label: "整備記録" },
  { value: "INVOICE", label: "請求書" },
  { value: "CONTRACT", label: "契約書" },
  { value: "OTHER", label: "その他" },
];

export default function AddDocumentForm({ vehicleId }: { vehicleId: string }) {
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
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={
              "rounded-full px-4 py-2 text-sm " +
              (type === t.value
                ? "bg-accent font-medium text-black"
                : "border border-neutral-700 text-muted")
            }
          >
            {t.label}
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
          <span className="mt-1 text-sm">書類を選ぶ（写真・PDF、最大{MAX_FILES}件）</span>
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
            一度に添付できるのは{MAX_FILES}件までです。
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
        書類は非公開で保管されます。公開ページには「書類あり」という事実だけが反映され、
        中身（画像・PDF）は第三者に見えません。
      </p>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-accent px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {isPending ? "アップロード中…" : "書類を追加する"}
      </button>
    </form>
  );
}
