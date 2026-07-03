-- ============================================================================
-- ARIOS Phase 1 — Core Infrastructure
-- 正本: ARIOS Database Design v1.0 (文書4) / Architecture v1.1 (文書2-1)
-- 完了条件: Vehicle が永久保存される
--
-- 絶対原則 (Database Design v1.0 / Core Principle):
--   Vehicle is permanent. Owner changes. History grows.
--   Trust accumulates. Data is never deleted.
--
-- このマイグレーションは Phase 1 の中核テーブルのみを作成する:
--   owners / vehicles / ownerships / histories / documents / images /
--   ai_analyses / trust_scores / audit_logs
-- Lead / Deal / Partner / Notification は定義済み(文書4)だが、各Phaseで追加する。
--
-- 設計判断:
--   - 物理削除を設計上禁止するため、参照は全て ON DELETE RESTRICT。
--     （Vehicle/Owner/History は削除できない。修正は追記＋AuditLogで残す）
--   - 区分値が文書4で列挙されているものは enum 型にする（意図を型で固定）。
--     列挙されていない status 系（vin_status / vehicle.status / verified_status）は
--     暫定で text とし、正本で値が確定し次第 enum 化する。
-- ============================================================================

-- ---- 拡張 ----
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---- 共通: updated_at 自動更新 ----
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- ENUM 型（文書4の区分値をそのまま）
-- ============================================================================
create type owner_type as enum (
  'PRIVATE_OWNER','DEALER','BROKER','COLLECTOR','WORKSHOP',
  'TRANSPORT','INSURANCE','CUSTOMS','LAWYER','TAX','OTHER'
);

create type vehicle_type as enum (
  'CAR','MOTORCYCLE','TRUCK','SUV','RACE_CAR','OFFROAD',
  'BOAT','AIRCRAFT','MACHINE','OTHER'
);

create type history_type as enum (
  'MANUFACTURE','OWNERSHIP','SALE','MAINTENANCE','REPAIR','RESTORATION',
  'ACCIDENT','RACE','EVENT','TRAVEL','IMPORT','EXPORT','AUCTION',
  'DOCUMENT','PHOTO','VIDEO','STORY','OTHER'
);

create type document_type as enum (
  'REGISTRATION','TITLE','INVOICE','SERVICE_RECORD','EXPORT_DOCUMENT',
  'IMPORT_DOCUMENT','CONTRACT','INSURANCE','RACE_RESULT','AUCTION_SHEET','OTHER'
);

create type image_type as enum (
  'EXTERIOR','INTERIOR','ENGINE','METER','VIN_PLATE','DOCUMENT',
  'DAMAGE','REPAIR','RACE','EVENT','OTHER'
);

create type analysis_type as enum (
  'VEHICLE_RECOGNITION','OCR','VIN_DECODE','DUPLICATE_CHECK','TRUST_ANALYSIS',
  'MATCHING','PRICE_REFERENCE','REGULATION_CHECK','DOCUMENT_CHECK'
);

create type trust_target_type as enum (
  'OWNER','VEHICLE','PARTNER','HISTORY','DEAL'
);

create type verification_level as enum (
  'LEVEL_0_SELF_REPORTED',
  'LEVEL_1_PHOTO_CONFIRMED',
  'LEVEL_2_DOCUMENT_CONFIRMED',
  'LEVEL_3_VIN_CONFIRMED',
  'LEVEL_4_AI_CONFIRMED',
  'LEVEL_5_PARTNER_CONFIRMED',
  'LEVEL_6_MANUFACTURER_CONFIRMED'
);

-- ============================================================================
-- 2. Owner — 人・会社・ディーラー・ブローカー・コレクター・パートナー候補
--    Owner is Independent: Owner情報とVehicle情報は分離する
-- ============================================================================
create table owners (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  company_name    text,
  country         text,
  language        text,
  email           text,
  phone           text,
  whatsapp        text,
  line            text,
  instagram       text,
  owner_type      owner_type,
  trust_level     text,            -- 暫定: 集約済みの信頼レベル表示用
  is_partner      boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- 3. Vehicle — 一台の乗り物そのもの。売却されても消えない（永久）
-- ============================================================================
create table vehicles (
  id               uuid primary key default gen_random_uuid(),
  vin              text,
  vin_normalized   text,           -- 検索・重複検出用の正規化VIN
  vin_status       text,           -- 暫定 text（正本で値確定後 enum 化）
  manufacturer     text,
  model            text,
  model_code       text,
  grade            text,
  year             integer,
  vehicle_type     vehicle_type,
  body_type        text,
  steering         text,           -- RHD / LHD 等（正本確定後 enum 化）
  transmission     text,
  exterior_color   text,
  interior_color   text,
  mileage          bigint,
  mileage_unit     text default 'km',
  current_owner_id uuid references owners(id) on delete restrict,
  trust_score      numeric,        -- 集約スコア（詳細は trust_scores）
  status           text,           -- 暫定 text（正本で値確定後 enum 化）
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================================
-- 4. Ownership — Owner と Vehicle をつなぐ所有履歴（過去所有者も残す）
-- ============================================================================
create table ownerships (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references vehicles(id) on delete restrict,
  owner_id    uuid not null references owners(id) on delete restrict,
  start_date  date,
  end_date    date,
  is_current  boolean not null default true,
  source      text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- 5. History — Vehicle の人生を記録する中核テーブル（削除不可）
--    修正する場合は AuditLog に記録する
-- ============================================================================
create table histories (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references vehicles(id) on delete restrict,
  owner_id        uuid references owners(id) on delete restrict,
  history_type    history_type not null,
  title           text,
  description     text,
  event_date      date,
  country         text,
  location        text,
  source          text,
  visibility      text not null default 'PUBLIC',  -- 削除せず visibility で制御
  verified_status text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- 9. Document — 車検証・請求書・整備記録・輸出書類など
-- ============================================================================
create table documents (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid references vehicles(id) on delete restrict,
  owner_id        uuid references owners(id) on delete restrict,
  deal_id         uuid,                 -- deals は後Phase。FKは作成後に追加
  history_id      uuid references histories(id) on delete restrict,
  document_type   document_type,
  file_url        text,
  ocr_text        text,
  ai_summary      text,
  verified_status text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- 10. Image — 車両・書類・修理・イベント写真
-- ============================================================================
create table images (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid references vehicles(id) on delete restrict,
  owner_id    uuid references owners(id) on delete restrict,
  history_id  uuid references histories(id) on delete restrict,
  lead_id     uuid,                     -- leads は後Phase。FKは作成後に追加
  image_url   text not null,
  image_type  image_type,
  ai_caption  text,
  ai_tags     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- 11. AIAnalysis — AI解析結果（上書きせず毎回保存。append-only）
-- ============================================================================
create table ai_analyses (
  id             uuid primary key default gen_random_uuid(),
  vehicle_id     uuid references vehicles(id) on delete restrict,
  lead_id        uuid,                  -- leads は後Phase
  image_id       uuid references images(id) on delete restrict,
  document_id    uuid references documents(id) on delete restrict,
  analysis_type  analysis_type,
  input_data     jsonb,
  output_json    jsonb,
  confidence     numeric,
  model_name     text,
  prompt_version text,
  created_at     timestamptz not null default now()
  -- updated_at なし: 解析結果は不変・履歴として積む
);

-- ============================================================================
-- 13. TrustScore — Vehicle/Owner/Partner/History/Deal の信頼度（証拠ベース）
-- ============================================================================
create table trust_scores (
  id                 uuid primary key default gen_random_uuid(),
  target_type        trust_target_type not null,
  target_id          uuid not null,     -- 対象が可変のためFKは張らない
  score              numeric,
  verification_level verification_level,
  reason             text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- 14. AuditLog — 誰がいつ何を変えたか（物理削除せず archive / visibility で対応）
-- ============================================================================
create table audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  target_table text,
  target_id    uuid,
  action       text,
  before_json  jsonb,
  after_json   jsonb,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- updated_at トリガー（updated_at を持つテーブルのみ）
-- ============================================================================
create trigger trg_owners_updated     before update on owners      for each row execute function set_updated_at();
create trigger trg_vehicles_updated   before update on vehicles    for each row execute function set_updated_at();
create trigger trg_ownerships_updated before update on ownerships  for each row execute function set_updated_at();
create trigger trg_histories_updated  before update on histories   for each row execute function set_updated_at();
create trigger trg_documents_updated  before update on documents   for each row execute function set_updated_at();
create trigger trg_images_updated      before update on images      for each row execute function set_updated_at();
create trigger trg_trust_updated       before update on trust_scores for each row execute function set_updated_at();

-- ============================================================================
-- インデックス
-- ============================================================================
create index idx_vehicles_vin_normalized on vehicles(vin_normalized);
create index idx_vehicles_current_owner  on vehicles(current_owner_id);
create index idx_ownerships_vehicle      on ownerships(vehicle_id);
create index idx_ownerships_owner        on ownerships(owner_id);
create index idx_ownerships_current      on ownerships(vehicle_id) where is_current;
create index idx_histories_vehicle       on histories(vehicle_id);
create index idx_histories_event_date    on histories(event_date);
create index idx_documents_vehicle       on documents(vehicle_id);
create index idx_images_vehicle          on images(vehicle_id);
create index idx_ai_analyses_vehicle     on ai_analyses(vehicle_id);
create index idx_trust_target            on trust_scores(target_type, target_id);
create index idx_audit_target            on audit_logs(target_table, target_id);

-- ============================================================================
-- Row Level Security
-- 既定で全テーブル RLS 有効（anonは遮断）。サーバー側 service_role は RLS をバイパスする。
-- 公開登録(Phase 2)・My Garage(Phase 3) で role 別ポリシーを段階的に追加する。
-- ============================================================================
alter table owners        enable row level security;
alter table vehicles      enable row level security;
alter table ownerships    enable row level security;
alter table histories     enable row level security;
alter table documents     enable row level security;
alter table images        enable row level security;
alter table ai_analyses   enable row level security;
alter table trust_scores  enable row level security;
alter table audit_logs    enable row level security;
