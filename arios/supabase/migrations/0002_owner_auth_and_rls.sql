-- ============================================================================
-- ARIOS Step 2 — Owner とログインユーザーの連携 + RLS ポリシー
-- 正本: Architecture v1.1 / Development Guide（Phase 2 認証・Phase 3 My Garage）
--
-- 目的:
--   - Supabase Auth のユーザー(auth.users)と Owner を 1:1 で結ぶ。
--   - ログインユーザーが「自分の Owner / 自分が所有する Vehicle とその履歴・写真」だけを
--     読み書きできるよう RLS ポリシーを張る。
--
-- 設計判断:
--   - History Never Dies に従い、authenticated には delete ポリシーを与えない
--     （select / insert / update のみ）。物理削除は設計上させない。
--   - 公開ページ(passport)や公開登録(Step1)はサーバーの service_role で動くため
--     RLS をバイパスする。ここで張るのは「ログインユーザー本人」向けの制御。
-- ============================================================================

-- Owner とログインユーザーの紐付け（既存 Owner は null のまま）
alter table owners
  add column if not exists auth_user_id uuid references auth.users(id) on delete restrict;

create unique index if not exists idx_owners_auth_user on owners(auth_user_id)
  where auth_user_id is not null;

-- ---- owners: 本人の行だけ ----
create policy owners_select_own on owners
  for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy owners_insert_own on owners
  for insert to authenticated
  with check (auth_user_id = (select auth.uid()));
create policy owners_update_own on owners
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- ---- vehicles: 自分が current_owner の車だけ ----
create policy vehicles_select_own on vehicles
  for select to authenticated
  using (current_owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));
create policy vehicles_insert_own on vehicles
  for insert to authenticated
  with check (current_owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));
create policy vehicles_update_own on vehicles
  for update to authenticated
  using (current_owner_id in
    (select id from owners where auth_user_id = (select auth.uid())))
  with check (current_owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));

-- ---- ownerships: 自分の所有レコード ----
create policy ownerships_select_own on ownerships
  for select to authenticated
  using (owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));
create policy ownerships_insert_own on ownerships
  for insert to authenticated
  with check (owner_id in
    (select id from owners where auth_user_id = (select auth.uid())));

-- ---- histories: 自分が所有する車の履歴 ----
create policy histories_select_own on histories
  for select to authenticated
  using (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
create policy histories_insert_own on histories
  for insert to authenticated
  with check (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
create policy histories_update_own on histories
  for update to authenticated
  using (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())))
  with check (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));

-- ---- images: 自分が所有する車の写真 ----
create policy images_select_own on images
  for select to authenticated
  using (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
create policy images_insert_own on images
  for insert to authenticated
  with check (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
