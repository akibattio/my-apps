"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { registerVehicle, type RegisterState } from "./actions";
import { resizeImage } from "@/app/listings/resize";
import { normalizeVin, isValidVin } from "@/app/listings/vin";
import MakerOptions, { MAKER_LIST_ID } from "@/app/listings/MakerOptions";
import { tr, fill, type Lang } from "@/lib/i18n";

const MAX_PHOTOS = 10; // actions.ts と同じ値

// マイガレージへの車の登録フォーム。車体番号・メーカー・車種が必須、年式と写真は任意。
export default function RegisterForm({ lang = "ja" }: { lang?: Lang }) {
  const t = tr(lang);
  const [state, formAction, isPending] = useActionState<RegisterState, FormData>(registerVehicle, {});
  const [vin, setVin] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!isValidVin(normalizeVin(vin))) {
      setLocalError(t("sell_vin_err"));
      return;
    }
    if (!manufacturer.trim() || !model.trim()) {
      setLocalError(t("form_err_makermodel"));
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.set("vin", vin);
    fd.set("manufacturer", manufacturer);
    fd.set("model", model);
    fd.set("year", year);
    for (const f of files) fd.append("photos", f);
    startTransition(() => formAction(fd));
  }

  const field =
    "w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-foreground placeholder:text-neutral-500";
  const label = "mb-1 block text-sm text-muted";
  const req = <span className="text-red-400"> {t("required")}</span>;
  const error = localError ?? state.error;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className={label}>{t("sell_vin")}{req}</label>
        <input
          className={field}
          value={vin}
          onChange={(e) => setVin(e.target.value)}
          placeholder={t("sell_vin_ph")}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-muted">{t("reg_vin_note")}</p>
      </div>
      <div>
        <label className={label}>{t("form_maker")}{req}</label>
        <input
          className={field}
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          placeholder={t("form_maker_ph")}
          list={MAKER_LIST_ID}
          autoComplete="off"
        />
        <MakerOptions lang={lang} />
      </div>
      <div>
        <label className={label}>{t("form_model")}{req}</label>
        <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("form_model_ph")} />
      </div>
      <div>
        <label className={label}>{t("reg_year")}{t("optional_paren")}</label>
        <input
          className={field}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder={t("reg_year_ph")}
        />
      </div>

      <div>
        <label
          htmlFor="photos"
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-700 px-6 py-8 text-muted hover:border-accent"
        >
          <span className="text-3xl text-accent">＋</span>
          <span className="mt-2 text-sm">
            {fill(t("reg_photos"), { n: MAX_PHOTOS })}
            {t("optional_paren")}
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending || preparing}
        className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-black disabled:opacity-60"
      >
        {isPending ? t("reg_submitting") : preparing ? t("reg_preparing") : t("reg_submit")}
      </button>
    </form>
  );
}
