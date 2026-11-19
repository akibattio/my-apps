-- ============================================================================
-- 0022 記録・写真・書類は「書いた本人と運営」だけが読める（2026-11-19）
--
--  穴: 運営が持ち主を付け替える（管理画面の decideClaim）と、新しい持ち主が、
--      前の持ち主の非公開の記録・写真・書類を読めた（読む方針が「今の持ち主の車の物は全部」だったため）。
--  直し: 会員（authenticated）が読めるのは、自分が書いた物（owner_id = 自分）だけにする。
--        運営は service_role で読むので、方針の対象外（今までどおり全部読める）。
--  2026-11-19 時点の本番: 持ち主の付け替えは0件、今の持ち主以外が書いた記録・写真は0件（読むだけで確認）。
--  先に、書いた人が空の行を、その車の今の持ち主で埋める（付け替えが0件なので、今の持ち主＝書いた人）。
--
--  ※ 本番への適用は秋葉さんの許可のあと。元に戻す SQL はファイルの最後（コメント）にある。
-- ============================================================================

-- ---- 1. 書いた人が空の行を埋める（運営のみの記録は除く） ----
update histories h
set owner_id = v.current_owner_id
from vehicles v
where v.id = h.vehicle_id and h.owner_id is null
  and h.visibility <> 'ADMIN' and v.current_owner_id is not null;

update images i
set owner_id = coalesce(
  (select h.owner_id from histories h where h.id = i.history_id),
  (select v.current_owner_id from vehicles v where v.id = i.vehicle_id))
where i.owner_id is null;

update documents d
set owner_id = coalesce(
  (select h.owner_id from histories h where h.id = d.history_id),
  (select v.current_owner_id from vehicles v where v.id = d.vehicle_id))
where d.owner_id is null;

-- ---- 2. 読む方針を「書いた本人」に替える ----
drop policy if exists histories_select_own on histories;
create policy histories_select_own on histories
  for select to authenticated
  using (visibility <> 'ADMIN' and owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));

drop policy if exists images_select_own on images;
create policy images_select_own on images
  for select to authenticated
  using (owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));

drop policy if exists documents_select_own on documents;
create policy documents_select_own on documents
  for select to authenticated
  using (owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));

-- 書き込みの方針は 0020 で外してある（会員は読むだけ）。ここでは触らない。

-- ============================================================================
-- 元に戻す SQL（0018・0002・0003 の方針に戻す。1 で埋めた owner_id はそのまま残す＝戻しても害がない）
-- ----------------------------------------------------------------------------
-- drop policy if exists histories_select_own on histories;
-- create policy histories_select_own on histories
--   for select to authenticated
--   using (visibility <> 'ADMIN' and vehicle_id in
--     (select v.id from vehicles v join owners o on v.current_owner_id = o.id
--      where o.auth_user_id = (select auth.uid())));
-- drop policy if exists images_select_own on images;
-- create policy images_select_own on images
--   for select to authenticated
--   using (vehicle_id in
--     (select v.id from vehicles v join owners o on v.current_owner_id = o.id
--      where o.auth_user_id = (select auth.uid())));
-- drop policy if exists documents_select_own on documents;
-- create policy documents_select_own on documents
--   for select to authenticated
--   using (vehicle_id in
--     (select v.id from vehicles v join owners o on v.current_owner_id = o.id
--      where o.auth_user_id = (select auth.uid())));
-- ============================================================================
