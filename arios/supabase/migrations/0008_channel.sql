-- ============================================================================
-- 0008 受付経路(channel): いつ(created_at)＋どの経路で依頼が来たかを記録
--  LINE / WHATSAPP / PHONE / REFERRAL / OTHER
-- ============================================================================
alter table inquiries
  add column if not exists channel text;
