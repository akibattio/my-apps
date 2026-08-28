-- ============================================================================
-- 0006 依頼(inquiry)の入力項目を追加
--  - vin: 車体番号（必須運用。DBは後方互換のため NULL 許可のまま）
--  - party_type: 区分（OWNER / BROKER / DEALER）
-- ============================================================================
alter table inquiries
  add column if not exists vin text,
  add column if not exists party_type text;
