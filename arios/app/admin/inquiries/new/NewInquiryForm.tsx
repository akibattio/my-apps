"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { createInquiry, type InquiryState } from "../actions";

const MAX_PHOTOS = 10;

// 送信前にブラウザ側で画像を縮小＆JPEG化（アップロードを軽くし失敗を防ぐ）。
async function resizeImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("image load failed"));
      im.src = dataUrl;
    });
    let { width, height } = img;
    if (Math.max(width, height) > maxDim) {
      const s = maxDim / Math.max(width, height);
      width = Math.round(width * s);
      height = Math.round(height * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

const SOURCES = [
  { v: "MANUAL", label: "その他/来店" },
  { v: "LINE", label: "LINE" },
  { v: "PHONE", label: "電話" },
  { v: "EMAIL", label: "メール" },
];

export default function NewInquiryForm() {
  const [state, formAction, isPending] = useActionState<InquiryState, FormData>(
    createInquiry,
    {}
  );
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [vehicleText, setVehicleText] = useState("");
  const [message, setMessage] = useState("");

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
    setPreparing(true);
    previews.forEach((u) => URL.revokeObjectURL(u));
    const resized = await Promise.all(selected.map((f) => resizeImage(f)));
    setFiles(resized);
    setPreviews(resized.map((f) => URL.createObjectURL(f)));
    setPreparing(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("name", name);
    fd.set("contact", contact);
    fd.set("contactMethod", source);
    fd.set("source", source);
    fd.set("vehicleText", vehicleText);
    fd.set("message", message);
    for (const f of files) fd.append("photos", f);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted">受付方法</label>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              type="button"
              key={s.v}
              onClick={() => setSource(s.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                source === s.v
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-neutral-700 text-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <input
        className={field}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="顧客名（例: 山田様）"
      />
      <input
        className={field}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="連絡先（電話 / メール / LINE名 など）"
      />
      <input
        className={field}
        value={vehicleText}
        onChange={(e) => setVehicleText(e.target.value)}
        placeholder="車について（例: フェラーリ 488 / 車検 / 板金 など）"
      />
      <textarea
        className={`${field} min-h-28`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="ご相談・依頼内容、やり取りのメモ"
      />

      <div>
        <label
          htmlFor="inq-photos"
          className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted"
        >
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">写真を添付（任意・最大{MAX_PHOTOS}枚）</span>
        </label>
        <input
          ref={inputRef}
          id="inq-photos"
          type="file"
          accept="image/*"
          multiple
          onChange={onFilesChange}
          className="hidden"
        />
        {preparing && <p className="mt-2 text-sm text-muted">写真を準備中…</p>}
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {previews.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="" className="aspect-square w-full rounded-md object-cover" />
            ))}
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending || preparing}
        className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60"
      >
        {isPending ? "登録中…" : preparing ? "写真を準備中…" : "この依頼を登録する"}
      </button>
    </form>
  );
}
