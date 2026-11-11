"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { addHistory, type AddHistoryState } from "./actions";
import { resizeImage } from "@/app/listings/resize";
import { tr, fill, type Lang } from "@/lib/i18n";

const MAX_PHOTOS = 10; // actions.ts と同じ値
const TYPES = ["MAINTENANCE", "REPAIR", "EVENT", "TRAVEL", "OTHER"];

// 記録（整備・修理・イベント・旅・その他）の入力フォーム。整備・修理は次回予定日と走行距離も入れられる。
export default function AddHistoryForm({
  vehicleId,
  today,
  lang = "ja",
}: {
  vehicleId: string;
  today: string;
  lang?: Lang;
}) {
  const t = tr(lang);
  const [state, formAction, isPending] = useActionState<AddHistoryState, FormData>(addHistory, {});
  const [type, setType] = useState("MAINTENANCE");
  const [eventDate, setEventDate] = useState(today);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [mileage, setMileage] = useState("");
  const [links, setLinks] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isService = type === "MAINTENANCE" || type === "REPAIR";

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > MAX_PHOTOS) {
      setLocalError(fill(t("reg_err_photos"), { n: MAX_PHOTOS }));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setLocalError(null);
    setPreparing(true);
    previews.forEach((u) => URL.revokeObjectURL(u));
    const resized = await Promise.all(selected.map((f) => resizeImage(f)));
    setFiles(resized);
    setPreviews(resized.map((f) => URL.createObjectURL(f)));
    setPreparing(false);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const linkLines = links.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (linkLines.some((l) => !/^https:\/\/\S+$/.test(l))) {
      setLocalError(t("ah_err_link"));
      return;
    }
    if (!title.trim() && !memo.trim() && files.length === 0 && linkLines.length === 0) {
      setLocalError(t("ah_err_empty"));
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("vehicleId", vehicleId);
    fd.set("historyType", type);
    fd.set("eventDate", eventDate);
    fd.set("title", title);
    fd.set("memo", memo);
    if (isService) {
      fd.set("nextDueDate", nextDue);
      fd.set("mileage", mileage);
    }
    fd.set("links", links);
    fd.set("public", isPublic ? "on" : "");
    for (const f of files) fd.append("photos", f);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const opt = t("optional_paren");
  const error = localError ?? state.error;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={`rounded-full border px-4 py-2 text-sm ${
              type === v ? "border-accent bg-accent/10 text-accent" : "border-neutral-700 text-muted"
            }`}
          >
            {t(`ht_${v}`)}
          </button>
        ))}
      </div>

      <div>
        <label className={label}>{t("ah_date")}</label>
        <input type="date" className={field} value={eventDate} max={today} onChange={(e) => setEventDate(e.target.value)} />
      </div>
      <div>
        <label className={label}>{t("ah_title_label")}{opt}</label>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("ah_title_ph")} maxLength={100} />
      </div>
      <div>
        <label className={label}>{t("ah_memo")}{opt}</label>
        <textarea className={`${field} min-h-24`} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("ah_memo_ph")} maxLength={4000} />
      </div>

      {isService && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>{t("ah_next_due")}{opt}</label>
            <input type="date" className={field} value={nextDue} min={eventDate} onChange={(e) => setNextDue(e.target.value)} />
          </div>
          <div>
            <label className={label}>{t("ah_mileage")}{opt}</label>
            <input
              className={field}
              value={mileage}
              onChange={(e) => setMileage(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
              inputMode="numeric"
              placeholder="52000"
            />
          </div>
          <p className="col-span-2 -mt-1 text-xs text-muted">{t("ah_next_due_note")}</p>
        </div>
      )}

      <div>
        <label className={label}>{t("ah_links")}{opt}</label>
        <textarea
          className={`${field} min-h-20 font-mono text-sm`}
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          placeholder={t("ah_links_ph")}
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div>
        <label
          htmlFor="photos"
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-700 px-6 py-6 text-muted hover:border-accent"
        >
          <span className="text-2xl text-accent">＋</span>
          <span className="mt-1 text-sm">
            {fill(t("ah_photos"), { n: MAX_PHOTOS })}
            {opt}
          </span>
        </label>
        <input ref={inputRef} id="photos" type="file" accept="image/*" multiple onChange={onFilesChange} className="hidden" />
        {preparing && <p className="mt-2 text-sm text-muted">{t("reg_preparing")}</p>}
        {previews.length > 0 && (
          <div className="mt-3 grid grid-cols-5 gap-2">
            {previews.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" className="aspect-square w-full rounded-md object-cover" />
            ))}
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
        <input type="checkbox" className="mt-0.5" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span>
          {t("ah_public")}
          <span className="mt-0.5 block text-xs text-muted">{t("ah_public_note")}</span>
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending || preparing}
        className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60"
      >
        {isPending ? t("ah_submitting") : preparing ? t("reg_preparing") : t("ah_submit")}
      </button>
    </form>
  );
}
