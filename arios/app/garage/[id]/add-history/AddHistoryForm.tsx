"use client";

import { useActionState, useRef, useState } from "react";
import { addHistory, type AddHistoryState } from "./actions";

const MAX_PHOTOS = 10;
const TYPES = [
  { value: "MAINTENANCE", label: "整備" },
  { value: "REPAIR", label: "修理" },
  { value: "TRAVEL", label: "旅" },
  { value: "EVENT", label: "イベント" },
  { value: "OTHER", label: "その他" },
];

export default function AddHistoryForm({
  vehicleId,
  today,
}: {
  vehicleId: string;
  today: string;
}) {
  const [state, formAction, isPending] = useActionState<AddHistoryState, FormData>(
    addHistory,
    {}
  );
  const [type, setType] = useState("MAINTENANCE");
  const [previews, setPreviews] = useState<string[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > MAX_PHOTOS) {
      setTooMany(true);
      setPreviews([]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setTooMany(false);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="historyType" value={type} />

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

      {/* 写真 */}
      <div>
        <label
          htmlFor="photos"
          className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted"
        >
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">写真を追加（最大{MAX_PHOTOS}枚）</span>
        </label>
        <input
          ref={inputRef}
          id="photos"
          name="photos"
          type="file"
          accept="image/*"
          multiple
          onChange={onFilesChange}
          className="hidden"
        />
        {tooMany && (
          <p className="mt-2 text-sm text-red-400">写真は最大{MAX_PHOTOS}枚までです。</p>
        )}
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {previews.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="aspect-square w-full rounded-md object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <textarea
        name="memo"
        rows={3}
        placeholder="何をした？（例: エンジンオイルとフィルターを交換）"
        className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
      />

      <div>
        <label className="mb-2 block text-sm text-muted">日付</label>
        <input
          name="eventDate"
          type="date"
          defaultValue={today}
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground"
        />
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-accent px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {isPending ? "追加中…" : "Timelineに追加"}
      </button>
    </form>
  );
}
