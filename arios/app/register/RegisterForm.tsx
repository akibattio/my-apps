"use client";

import { useActionState, useRef, useState } from "react";
import { registerVehicle, type RegisterState } from "./actions";
import { recognizePhoto } from "./recognize-action";

const MAX_PHOTOS = 10;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1)); // data URL のヘッダを除去
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function RegisterForm() {
  const [state, formAction, isPending] = useActionState<RegisterState, FormData>(
    registerVehicle,
    {}
  );
  const [previews, setPreviews] = useState<string[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 手入力フィールド（AIが下書き→人が確認・修正できるよう controlled にする）
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  // AI下書きの状態
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > MAX_PHOTOS) {
      setTooMany(true);
      setPreviews([]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setTooMany(false);
    setAiNote(null);
    setAiError(null);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  async function onAiDraft() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setAiBusy(true);
    setAiError(null);
    setAiNote(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await recognizePhoto(base64, file.type || "image/jpeg");
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      if (res.manufacturer) setManufacturer(res.manufacturer);
      if (res.model) setModel(res.model);
      if (res.year) setYear(res.year);
      const pct = Math.round((res.confidence ?? 0) * 100);
      setAiNote(`AIの下書き（確信度 ${pct}%）：${res.evidence}　※内容を確認・修正してください`);
    } catch {
      setAiError("写真の読み込みに失敗しました。");
    } finally {
      setAiBusy(false);
    }
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

        {/* AIで下書き（写真がある時だけ表示）*/}
        {previews.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onAiDraft}
              disabled={aiBusy}
              className="w-full rounded-lg border border-accent px-4 py-3 text-sm font-medium text-accent disabled:opacity-60"
            >
              {aiBusy ? "AIが写真を確認中…" : "✨ AIで下書きする（1枚目の写真から）"}
            </button>
            {aiNote && <p className="mt-2 text-xs text-muted">{aiNote}</p>}
            {aiError && <p className="mt-2 text-sm text-red-400">{aiError}</p>}
          </div>
        )}
      </div>

      {/* 最小限の手入力（AIが下書き→人が確認）*/}
      <div className="space-y-3">
        <input
          name="manufacturer"
          type="text"
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          placeholder="メーカー（例: トヨタ）"
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
        />
        <input
          name="model"
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="モデル（例: スープラ）"
          className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500"
        />
        <input
          name="year"
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
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
