// 取引(Deal)のステータス定義。ページ/アクション双方から参照する共有定数。
export const DEAL_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "進行中",
  CLOSED: "成約",
  CANCELLED: "キャンセル",
};

export const DEAL_STATUS_FLOW = ["IN_PROGRESS", "CLOSED", "CANCELLED"] as const;

// 一覧の件数で「有効(生きている取引)」とみなすステータス。
export const DEAL_STATUS_LIVE = ["IN_PROGRESS", "CLOSED"];

// バッジ配色（管理画面用）。
export const DEAL_STATUS_STYLE: Record<string, string> = {
  IN_PROGRESS: "text-primary bg-primary/10",
  CLOSED: "text-emerald-300 bg-emerald-400/10",
  CANCELLED: "text-muted bg-white/5",
};
