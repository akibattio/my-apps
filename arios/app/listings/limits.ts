// 売りたい・買いたいの入力の長さの上限（保存とメールの両方で使う）。サーバー/クライアント共用。
export const LIMITS = {
  maker: 60,
  model: 100,
  name: 100,
  company: 100,
  contact: 100,
  email: 254,
  message: 2000,
} as const;
