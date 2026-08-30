-- ============================================================================
-- 0009 Follow-up 管理（案件を取りこぼさない）
--  - next_action_date: 次にやること／いつ追う
--  - last_contact_at:  最終接触日時
--  - note:             内部フォローアップメモ（依頼内容 message とは別）
--  status は商談向けの値に運用変更: NEW / CONTACTED / NEGOTIATING / CLOSED / DROPPED
--  （旧: IN_PROGRESS→NEGOTIATING, DONE→CLOSED, ARCHIVED→DROPPED に読み替え）
-- ============================================================================
alter table inquiries
  add column if not exists next_action_date date,
  add column if not exists last_contact_at  timestamptz,
  add column if not exists note             text;

-- 既存データがあれば新ステータスへ寄せる（無ければ無害）
update inquiries set status = 'NEGOTIATING' where status = 'IN_PROGRESS';
update inquiries set status = 'CLOSED'      where status = 'DONE';
update inquiries set status = 'DROPPED'     where status = 'ARCHIVED';
