-- ============================================================================
-- 0005 依頼(inquiry)と車両(vehicle)の紐付け
-- 依頼を「車両として登録」した時に、その車両IDを保持する。
-- ============================================================================
alter table inquiries
  add column if not exists vehicle_id uuid references vehicles(id) on delete set null;

create index if not exists inquiries_vehicle_id_idx on inquiries (vehicle_id);
