"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { createInquiry, type InquiryState } from "../actions";

const MAX_PHOTOS = 30;

// 送信前にブラウザ側で画像を縮小＆JPEG化（枚数が多いので強めに縮小）。
async function resizeImage(file: File, maxDim = 1280, quality = 0.62): Promise<File> {
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

const PARTIES = [
  { v: "OWNER", label: "オーナー" },
  { v: "BROKER", label: "ブローカー" },
  { v: "DEALER", label: "ディーラー" },
];
const CONTACT_METHODS = [
  { v: "PHONE", label: "電話番号" },
  { v: "LINE", label: "LINE ID" },
];

export default function NewInquiryForm() {
  const [state, formAction, isPending] = useActionState<InquiryState, FormData>(
    createInquiry,
    {}
  );
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [party, setParty] = useState("OWNER");
  const [vin, setVin] = useState("");
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [vehicleText, setVehicleText] = useState("");
  const [message, setMessage] = useState("");

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS);
    setLocalError(
      (e.target.files?.length ?? 0) > MAX_PHOTOS
        ? `写真は最大${MAX_PHOTOS}枚までです。`
        : null
    );
    setPreparing(true);
    previews.forEach((u) => URL.revokeObjectURL(u));
    const resized = await Promise.all(selected.map((f) => resizeImage(f)));
    setFiles(resized);
    setPreviews(resized.map((f) => URL.createObjectURL(f)));
    setPreparing(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vin.trim()) {
      setLocalError("車体番号（必須）を入力してください。");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("vin", vin);
    fd.set("partyType", party);
    fd.set("contactMethod", contactMethod);
    fd.set("contact", contact);
    fd.set("name", name);
    fd.set("vehicleText", vehicleText);
    fd.set("message", message);
    for (const f of files) fd.append("photos", f);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* 区分 */}
      <div>
        <label className={label}>区分</label>
        <div className="flex flex-wrap gap-2">
          {PARTIES.map((p) => (
            <button
              type="button"
              key={p.v}
              onClick={() => setParty(p.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                party === p.v
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-neutral-700 text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 車体番号（必須） */}
      <div>
        <label className={label}>
          車体番号 <span className="text-red-400">必須</span>
        </label>
        <input
          className={field}
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder="例: ZFF79ALA4J0231234"
          autoCapitalize="characters"
        />
      </div>

      {/* 連絡先（電話 or LINE ID） */}
      <div>
        <label className={label}>連絡先</label>
        <div className="mb-2 flex gap-2">
          {CONTACT_METHODS.map((m) => (
            <button
              type="button"
              key={m.v}
              onClick={() => setContactMethod(m.v)}
              className={`rounded-full border px-4 py-2 text-sm ${
                contactMethod === m.v
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-neutral-700 text-muted"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          className={field}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={contactMethod === "LINE" ? "LINE ID" : "電話番号"}
        />
      </div>

      {/* 任意項目 */}
      <input
        className={field}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="お名前・会社名（任意）"
      />
      <input
        className={field}
        value={vehicleText}
        onChange={(e) => setVehicleText(e.target.value)}
        placeholder="車種・年式など（任意 例: フェラーリ 488）"
      />
      <textarea
        className={`${field} min-h-24`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="ご相談・依頼内容、メモ（任意）"
      />

      {/* 写真（最大30枚） */}
      <div>
        <label
          htmlFor="inq-photos"
          className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted"
        >
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">写真を追加（最大{MAX_PHOTOS}枚）</span>
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
          <>
            <p className="mt-2 text-xs text-muted">{previews.length} 枚を添付</p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {previews.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="aspect-square w-full rounded-md object-cover" />
              ))}
            </div>
          </>
        )}
      </div>

      {(localError || state.error) && (
        <p className="text-sm text-red-400">{localError || state.error}</p>
      )}

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
