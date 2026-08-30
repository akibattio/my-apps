// 依頼のステータス定義（サーバーアクション/ページ双方から参照する共有定数）。
export const STATUS_LABEL: Record<string, string> = {
  NEW: "新着",
  IN_PROGRESS: "対応中",
  DONE: "完了",
  ARCHIVED: "保管",
};

export const STATUS_FLOW = ["NEW", "IN_PROGRESS", "DONE", "ARCHIVED"] as const;

export const KIND_LABEL: Record<string, string> = {
  SELL: "売りたい",
  BUY: "買いたい",
};

export const CHANNEL_LABEL: Record<string, string> = {
  LINE: "LINE",
  WHATSAPP: "WhatsApp",
  PHONE: "電話",
  REFERRAL: "紹介",
  OTHER: "その他",
};

export const PARTY_LABEL: Record<string, string> = {
  OWNER: "オーナー",
  BROKER: "ブローカー",
  DEALER: "ディーラー",
};

export const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "その他/来店",
  LINE: "LINE",
  PHONE: "電話",
  EMAIL: "メール",
  WEB_FORM: "Webフォーム",
  WHATSAPP: "WhatsApp",
};
