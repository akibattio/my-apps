// 依頼のステータス定義（サーバーアクション/ページ双方から参照する共有定数）。
export const STATUS_LABEL: Record<string, string> = {
  NEW: "新規",
  CONTACTED: "連絡済",
  NEGOTIATING: "商談中",
  CLOSED: "成約",
  DROPPED: "見送り",
};

export const STATUS_FLOW = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "CLOSED",
  "DROPPED",
] as const;

// 対応中（アクティブ）とみなすステータス。買い/売り/マッチングの一覧はこれで絞る。
export const STATUS_ACTIVE = ["NEW", "CONTACTED", "NEGOTIATING"];

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
