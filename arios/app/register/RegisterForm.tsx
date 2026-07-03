"use client";

import { useActionState, useRef, useState } from "react";
import { registerVehicle, type RegisterState } from "./actions";

const MAX_PHOTOS = 10;

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState<RegisterState, FormData>(
    registerVehicle,
    {}
  );
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
      {/* 写真アップロード（最大10枚）*/}
      <div>
        <label
          htmlFor="photos"
          className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted"
        >
          <span className="text-3xl text-accent">＋</span>
          <span className="mt-2 text-sm">写真を撮る / 選ぶ（最大{MAX_PHOTOS}枚）</span>
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
          <p className="mt-2 text-sm text-red-400">
            写真は最大{MAX_PHOTOS}枚までです。選び直してください。
          </p>
        )}
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {previews.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`選択した写真 ${i + 1}`}
                className="aspect-square w-full rounded-md object-cover"
              />
            ))}
          </div>
        )}
        {previews.length > 0 && (
          <p className="mt-2 text-xs text-muted">{previews.length}枚を選択中</p>
        )}
      </div>

      {/* 最小限の手入力 */}
      <div className="space-y-3">
        <input
          name="manufacturer"
          type="text"
          placeholder="メーカー（例: トヨタ）"
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
        />
        <input
          name="model"
          type="text"
          placeholder="モデル（例: スープラ）"
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
        />
        <input
          name="year"
          type="number"
          inputMode="numeric"
          placeholder="年式（例: 1994）"
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
        />
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-accent px-6 py-4 font-medium text-black disabled:opacity-60"
      >
        {isPending ? "登録中…" : "この車を登録する"}
      </button>

      <p className="text-center text-xs text-muted">
        写真か車名だけでも登録できます。あとから追加・修正できます。
      </p>
    </form>
  );
}
