"use client";

import { useState, startTransition } from "react";
import { resizeImage } from "@/app/listings/resize";
import { addListingPhotos, removeListingPhoto } from "../../actions";

const MAX_PHOTOS = 20;

// マイページから写真を追加・削除する部品（クライアント側で縮小してアップロード）。
export default function ListingPhotos({
  id,
  photos,
}: {
  id: string;
  photos: { path: string; url: string }[];
}) {
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const room = MAX_PHOTOS - photos.length;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
    if (files.length === 0) return;
    setPreparing(true);
    const resized = await Promise.all(files.map((f) => resizeImage(f)));
    setPreparing(false);
    const fd = new FormData();
    fd.set("id", id);
    for (const f of resized) fd.append("photos", f);
    setBusy(true);
    startTransition(() => addListingPhotos(fd));
  }

  return (
    <div>
      {photos.length > 0 && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="aspect-square w-full rounded-md object-cover" />
              <form action={removeListingPhoto} className="absolute right-1 top-1">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="path" value={p.path} />
                <button
                  type="submit"
                  aria-label="削除"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {room > 0 ? (
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-neutral-600 text-muted">
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">
            {busy ? "アップロード中…" : preparing ? "準備中…" : `写真を追加（あと${room}枚）`}
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy || preparing}
            onChange={onPick}
          />
        </label>
      ) : (
        <p className="text-xs text-muted">写真は最大 {MAX_PHOTOS} 枚までです。</p>
      )}
      <p className="mt-2 text-xs text-muted">
        写真はあとから何度でも追加できます（1枚ずつでもOK）。
      </p>
    </div>
  );
}
