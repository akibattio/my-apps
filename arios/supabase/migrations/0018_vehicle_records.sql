-- ============================================================================
-- 0018 車体番号ごとの車の記録（第3バッチA / 鈴木さん 2026-11-11 合意）
--
--  - 1つの車体番号につき車の記録は1つ（vin_normalized を一意に）。
--    vin_normalized は vin からトリガーで自動計算する（アプリ側の normalizeVin と同じ規則）。
--  - 「売りたい」登録は車体番号で車の記録に自動でつながる（inquiries.vehicle_id）。
--  - 記録ごとに「どの経路で入ったか」を残す（vehicles.source / histories.source / histories.inquiry_id）。
--  - 履歴は既定で非公開。ADMIN は運営だけが見る記録（売りたい登録の経緯など）。
--  - 車ごとの公開ページ（パスポート）は持ち主が公開を選んだときだけ（vehicles.is_public）。
--  - すでに別の会員の車として登録されている車体番号に「オーナー」として登録が来たら、
--    所有者は書き換えず vehicle_claims に確認待ちとして残し、運営が判断する。
-- ============================================================================

-- ---- 車体番号の正規化（app/listings/vin.ts の normalizeVin と同じ）----
create or replace function normalize_vin(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    upper(
      regexp_replace(
        regexp_replace(normalize(coalesce(raw, ''), NFKC), '\s', '', 'g'),
        '[‐－―ー−]', '-', 'g'
      )
    ),
    ''
  );
$$;

create or replace function vehicles_set_vin_normalized()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.vin_normalized := public.normalize_vin(new.vin);
  return new;
end;
$$;

drop trigger if exists vehicles_vin_normalized on vehicles;
create trigger vehicles_vin_normalized
  before insert or update of vin on vehicles
  for each row execute function vehicles_set_vin_normalized();

update vehicles set vin = vin where vin is not null;

create unique index if not exists vehicles_vin_normalized_key
  on vehicles (vin_normalized) where vin_normalized is not null;

-- ---- 車の記録: 出どころ・公開 ----
alter table vehicles
  add column if not exists source text,                              -- SELL_LISTING / MEMBER / ADMIN
  add column if not exists is_public boolean not null default false; -- パスポートを公開するか

-- ---- 履歴: 既定は非公開、どの登録から来たか ----
alter table histories alter column visibility set default 'PRIVATE';
alter table histories
  add column if not exists inquiry_id uuid references inquiries(id) on delete set null;
create index if not exists histories_vehicle_idx on histories (vehicle_id);
create index if not exists histories_inquiry_idx on histories (inquiry_id);

-- ---- 所有者の確認待ち ----
create table if not exists vehicle_claims (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references vehicles(id) on delete restrict,
  owner_id    uuid not null references owners(id) on delete restrict,
  inquiry_id  uuid references inquiries(id) on delete set null,
  status      text not null default 'PENDING',  -- PENDING / APPROVED / REJECTED
  note        text,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists vehicle_claims_vehicle_idx on vehicle_claims (vehicle_id);
create unique index if not exists vehicle_claims_pending_key
  on vehicle_claims (vehicle_id, owner_id) where status = 'PENDING';
alter table vehicle_claims enable row level security;
-- 会員向けのポリシーは張らない（読み書きはサーバーの service_role のみ）

-- ---- 会員本人の直接書き込みを絞る ----
-- 車の記録の作成と、車体番号・所有者・公開設定の変更はサーバー側の処理だけが行う
-- （会員がAPIを直接たたいて同じ車体番号の車を作ったり、持ち主を書き換えたりできないように）。
revoke insert, update on vehicles from authenticated;
grant update (manufacturer, model, model_code, grade, year, body_type, steering,
              transmission, exterior_color, interior_color, mileage, mileage_unit)
  on vehicles to authenticated;

-- 運営だけの記録（ADMIN）は会員から見えない・変えられない
drop policy if exists histories_select_own on histories;
create policy histories_select_own on histories
  for select to authenticated
  using (visibility <> 'ADMIN' and vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
drop policy if exists histories_insert_own on histories;
create policy histories_insert_own on histories
  for insert to authenticated
  with check (visibility <> 'ADMIN' and vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
drop policy if exists histories_update_own on histories;
create policy histories_update_own on histories
  for update to authenticated
  using (visibility <> 'ADMIN' and vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())))
  with check (visibility <> 'ADMIN' and vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));

-- ---- 既存の「売りたい」登録をつなぐ（本番は 2026-11-11 時点で vehicles 0件）----
-- オーナー本人の登録は、その会員を持ち主にする（Owner が無ければ作る）。
insert into owners (auth_user_id, name, email, owner_type)
select distinct on (i.auth_user_id) i.auth_user_id, coalesce(u.email, 'オーナー'), u.email, 'PRIVATE_OWNER'
from inquiries i
join auth.users u on u.id = i.auth_user_id
where i.kind = 'SELL' and i.party_type = 'OWNER' and normalize_vin(i.vin) is not null
  and not exists (select 1 from owners o where o.auth_user_id = i.auth_user_id);

with firsts as (
  select distinct on (normalize_vin(i.vin))
    normalize_vin(i.vin) as vin_n, i.vin, i.manufacturer, i.model,
    case when i.party_type = 'OWNER' then o.id end as owner_id
  from inquiries i
  left join owners o on o.auth_user_id = i.auth_user_id
  where i.kind = 'SELL' and normalize_vin(i.vin) is not null
  order by normalize_vin(i.vin), (i.party_type = 'OWNER') desc, i.created_at
)
insert into vehicles (vin, manufacturer, model, status, source, current_owner_id)
select f.vin, f.manufacturer, f.model, 'REGISTERED', 'SELL_LISTING', f.owner_id
from firsts f
where not exists (select 1 from vehicles v where v.vin_normalized = f.vin_n);

insert into ownerships (vehicle_id, owner_id, is_current, start_date, source)
select v.id, v.current_owner_id, true, current_date, 'SELL_LISTING'
from vehicles v
where v.source = 'SELL_LISTING' and v.current_owner_id is not null
  and not exists (select 1 from ownerships s where s.vehicle_id = v.id);

update inquiries i
set vehicle_id = v.id
from vehicles v
where i.kind = 'SELL' and i.vehicle_id is null
  and v.vin_normalized = normalize_vin(i.vin);

insert into histories (vehicle_id, owner_id, history_type, title, event_date, source, visibility, inquiry_id)
select i.vehicle_id, o.id, 'OTHER',
  '売りたい登録（' || case i.party_type when 'OWNER' then 'オーナー' when 'BROKER' then '仲介'
                                   when 'DEALER' then '業者' else '区分なし' end || '）',
  i.created_at::date, 'SELL_LISTING', 'ADMIN', i.id
from inquiries i
left join owners o on o.auth_user_id = i.auth_user_id
where i.kind = 'SELL' and i.vehicle_id is not null
  and not exists (select 1 from histories h where h.inquiry_id = i.id);
