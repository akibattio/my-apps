-- ============================================================================
-- 0021 記録の種別「購入」と、車のプロフィール（鈴木さん 2026-11-13 の確認事項 1・4）
--  - 記録の種別に PURCHASE（購入）を足す。車の歴史は購入から始まるため
--  - 車自体の情報（記録とは別）: 色（外装・内装は既存の列）、アピールポイント、純正オプション、事故歴
--    事故歴は YES（あり）/ NO（なし）/ UNKNOWN（わからない）。未入力は null
--  会員の書き込みはサーバー側（service_role）で本人の車か確認してから行う。
-- ============================================================================
alter type history_type add value if not exists 'PURCHASE';

alter table vehicles
  add column if not exists appeal_points text,
  add column if not exists factory_options text,
  add column if not exists accident_history text;

do $$ begin
  alter table vehicles
    add constraint vehicles_accident_history_check
    check (accident_history in ('YES', 'NO', 'UNKNOWN'));
exception when duplicate_object then null;
end $$;
