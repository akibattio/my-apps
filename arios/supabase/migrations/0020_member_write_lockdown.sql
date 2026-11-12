-- ============================================================================
-- 0020 会員が Supabase を直接呼んで書ける範囲を絞る（セキュリティ点検 2026-11-12 修正6）
--
--  会員（authenticated）は、公開されている鍵と自分のログインで Supabase を直接呼ぶと、
--  histories・images・documents・owners・ownerships に書けた。これだとサーバー側の検証
--  （リンクは https だけ、走行距離は増えるだけ、写真は中身で判定、など）を通らない。
--  アプリの書き込みはすべてサーバー側の強い鍵（service_role）で本人確認をしてから行っているため、
--  会員の役割からは insert / update / delete の方針と権限を外し、select（読む）だけを残す。
--
--  確認済み（2026-11-12）: アプリのコードに、会員のログインのクライアントでこの5つのテーブルへ
--  書いている箇所は無い（読み取りは app/garage/page.tsx と app/garage/[id]/page.tsx のみ）。
--
--  ※ 本番への適用は秋葉さんの許可のあと。
-- ============================================================================

drop policy if exists histories_insert_own on histories;
drop policy if exists histories_update_own on histories;
drop policy if exists images_insert_own on images;
drop policy if exists images_update_own on images;
drop policy if exists documents_insert_own on documents;
drop policy if exists documents_update_own on documents;
drop policy if exists owners_insert_own on owners;
drop policy if exists owners_update_own on owners;
drop policy if exists ownerships_insert_own on ownerships;
drop policy if exists ownerships_update_own on ownerships;

revoke insert, update, delete on histories, images, documents, owners, ownerships from authenticated;
revoke insert, update, delete on histories, images, documents, owners, ownerships from anon;

-- 読む方針（*_select_own）はそのまま残す。
