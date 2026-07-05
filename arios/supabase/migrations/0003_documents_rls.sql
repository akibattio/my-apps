-- ============================================================================
-- ARIOS 地固め — documents の RLS ポリシー
-- 0002 で owners/vehicles/histories/images/ownerships には張ったが documents が
-- 未対応だった。ログインユーザーが「自分が所有する車の書類」を読み書きできるようにする。
-- （書類本体は非公開バケット。ここで制御するのは documents テーブルの行アクセス）
-- History Never Dies に従い delete ポリシーは与えない（select / insert / update のみ）。
-- ============================================================================

create policy documents_select_own on documents
  for select to authenticated
  using (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));

create policy documents_insert_own on documents
  for insert to authenticated
  with check (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));

create policy documents_update_own on documents
  for update to authenticated
  using (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())))
  with check (vehicle_id in
    (select v.id from vehicles v join owners o on v.current_owner_id = o.id
     where o.auth_user_id = (select auth.uid())));
