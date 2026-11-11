-- ============================================================================
-- 0019 マイガレージの履歴（第3バッチB / 鈴木さん 2026-11-11 合意）
--  - 整備の「次回予定日」と、そのときの走行距離
--  - YouTube / Instagram などのリンク（複数）
--  会員の書き込みはサーバー側（service_role）で本人の車か確認してから行う。
-- ============================================================================
alter table histories
  add column if not exists next_due_date date,
  add column if not exists mileage bigint,
  add column if not exists links text[];

create index if not exists histories_next_due_idx on histories (next_due_date)
  where next_due_date is not null;
