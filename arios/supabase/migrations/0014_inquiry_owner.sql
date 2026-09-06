-- ============================================================================
-- 0014 依頼の所有者を認証ユーザーIDで持つ（セキュリティ強化）
--  これまで「email 文字列の一致」で本人判定していたが、メール未確認のため
--  他人のメールで登録すると乗っ取れる恐れがあった。
--  ログイン中に作成された依頼は auth_user_id を必ず持たせ、マイページの
--  表示・編集はこの ID で権限判定する（email はあくまで連絡先）。
--  管理者の代理登録(STAFF)や過去データは auth_user_id = null（本人所有ではない）。
-- ============================================================================
alter table inquiries
  add column if not exists auth_user_id uuid;

create index if not exists inquiries_auth_user_idx on inquiries (auth_user_id);
