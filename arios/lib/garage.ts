// マイガレージの小さな共通処理（サーバー/クライアント共用）。

type DueRow = {
  vehicle_id: string;
  next_due_date: string | null;
  event_date: string | null;
  created_at: string;
};

// 車ごとの「次の整備予定日」。いちばん新しい記録に入っている予定日を使う
// （古い記録の予定日は、その後の整備で済んでいるはずなので見ない）。
export function nextDueByVehicle(rows: DueRow[]): Map<string, string> {
  const latest = new Map<string, DueRow>();
  for (const r of rows) {
    if (!r.next_due_date) continue;
    const cur = latest.get(r.vehicle_id);
    const k = (x: DueRow) => `${x.event_date ?? ""}|${x.created_at}`;
    if (!cur || k(r) > k(cur)) latest.set(r.vehicle_id, r);
  }
  const out = new Map<string, string>();
  for (const [id, r] of latest) out.set(id, r.next_due_date as string);
  return out;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function carName(v: { manufacturer: string | null; model: string | null }, fallback: string): string {
  return [v.manufacturer, v.model].filter(Boolean).join(" ") || fallback;
}

// 記録に付けるリンクの表示名（YouTube / Instagram / それ以外はドメイン名）。
export function linkLabel(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h === "youtu.be" || h.endsWith("youtube.com")) return "YouTube";
    if (h.endsWith("instagram.com")) return "Instagram";
    return h;
  } catch {
    return url;
  }
}

// 入力されたリンク（1行に1つ）を検査する。https のURLだけ、最大10件。
export function parseLinks(raw: string): { links: string[]; bad: boolean } {
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const links: string[] = [];
  for (const l of lines) {
    try {
      const u = new URL(l);
      if (u.protocol !== "https:") return { links: [], bad: true };
      links.push(u.toString().slice(0, 500));
    } catch {
      return { links: [], bad: true };
    }
  }
  return { links, bad: false };
}
