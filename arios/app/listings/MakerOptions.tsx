import { makerSuggestions } from "@/lib/carname";

// メーカー入力欄の候補（自由入力もできる）。input に list={MAKER_LIST_ID} を付けて使う。
export const MAKER_LIST_ID = "maker-options";

export default function MakerOptions({ lang }: { lang: "ja" | "en" }) {
  return (
    <datalist id={MAKER_LIST_ID}>
      {makerSuggestions(lang).map((m) => (
        <option key={m} value={m} />
      ))}
    </datalist>
  );
}
