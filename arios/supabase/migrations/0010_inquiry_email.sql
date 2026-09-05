-- ============================================================================
-- 0010 依頼にメールを追加（お客様マイページの紐付け用）
--  公開フォームで任意入力。ログインしたお客様のメールと突き合わせて
--  「自分の買いたい/売りたい」を表示する。
-- ============================================================================
alter table inquiries
  add column if not exists email text;

create index if not exists inquiries_email_idx on inquiries (lower(email));
