"use client";

import { deleteMyListing } from "../../actions";
import { tr, type Lang } from "@/lib/i18n";

// 自分の登録を削除する（確認ダイアログ付き）。
export default function DeleteListing({ id, lang }: { id: string; lang: Lang }) {
  const t = tr(lang);
  return (
    <form
      action={deleteMyListing}
      onSubmit={(e) => {
        if (!window.confirm(t("my_delete_confirm"))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="w-full rounded-full border border-red-500/40 px-6 py-3 text-sm text-red-400 hover:border-red-500"
      >
        {t("my_delete")}
      </button>
    </form>
  );
}
