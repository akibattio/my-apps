-- ============================================================================
-- 0013 登録者区分(registered_by) — お客様本人の登録か、管理者の代理登録か
--  SELF  = お客様本人が公開フォーム/マイページから登録
--  STAFF = 管理者が電話・LINE・来店などで受けて代理登録
--  管理者が一目でどちらか分かるようにする。既存データは source から推定して補完。
-- ============================================================================
alter table inquiries
  add column if not exists registered_by text not null default 'SELF';

-- 既存データ: 公開フォーム由来は本人、それ以外(AI_ASSIST/MANUAL等)は代理とみなす
update inquiries
  set registered_by = case when source = 'WEB_FORM' then 'SELF' else 'STAFF' end;
