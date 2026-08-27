-- ============================================================================
-- 0004 Inquiries — 外部からの相談・依頼の受け皿（Web依頼フォーム / 将来のLINE連携）
-- 公開フォームからの投稿はサーバーの service_role で書き込む（anon には許可しない）。
-- 管理画面も service_role で読むため、RLS はデフォルト拒否のままでよい。
-- ============================================================================
create table if not exists inquiries (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  contact        text,               -- メール/電話/LINE等（自由記述）
  contact_method text,               -- 任意: EMAIL / PHONE / LINE / OTHER
  vehicle_text   text,               -- 車について（自由記述）
  message        text,               -- ご相談・ご依頼内容
  photo_urls     text[] default '{}',-- 添付写真の公開URL
  status         text not null default 'NEW', -- NEW / IN_PROGRESS / DONE / ARCHIVED
  source         text not null default 'WEB_FORM', -- WEB_FORM / LINE / WHATSAPP ...
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists inquiries_status_created_idx
  on inquiries (status, created_at desc);

alter table inquiries enable row level security;
-- RLS ポリシーは意図的に未定義（＝anon 拒否）。読み書きはサーバーの service_role のみ。
