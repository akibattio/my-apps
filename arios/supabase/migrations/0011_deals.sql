-- ============================================================================
-- 0011 取引(Deal / 契約) — 成立したマッチの進行管理
--  マッチング(買い×売り)が成立したら「取引」として1件作成し、
--  進行履歴(deal_events)と契約情報(価格・成約日・メモ)を記録する。
--  買い/売りは inquiries を参照（削除されても取引は残す = set null）。
--  RLS は inquiries 同様に「有効・ポリシーなし」= service_role 専用（管理画面のみ）。
-- ============================================================================

create table if not exists deals (
  id                uuid primary key default gen_random_uuid(),
  buyer_inquiry_id  uuid references inquiries(id) on delete set null,
  seller_inquiry_id uuid references inquiries(id) on delete set null,
  manufacturer      text,                          -- メーカー（マッチのキー）
  model             text,                          -- 車種（マッチのキー）
  status            text not null default 'IN_PROGRESS', -- IN_PROGRESS / CLOSED / CANCELLED
  agreed_price      bigint,                        -- 成約価格
  contract_date     date,                          -- 成約日
  note              text,                          -- 契約メモ（最小限）
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists deals_status_created_idx on deals (status, created_at desc);

-- 進行履歴（追記のみ・削除しない）
create table if not exists deal_events (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references deals(id) on delete cascade,
  body       text not null,                        -- 履歴の1行メモ
  created_at timestamptz not null default now()
);

create index if not exists deal_events_deal_idx on deal_events (deal_id, created_at);

alter table deals       enable row level security;
alter table deal_events enable row level security;
-- ポリシーは作らない = anon/authenticated からは不可視。service_role(管理画面)のみ。
