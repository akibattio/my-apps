-- 売りたい登録のゲート（2026-11-07 鈴木さん依頼）
-- 仲介・業者が登録する場合は「オーナー本人からの依頼あり」の確認と、オーナー本人の名前（非公開・運営確認用）を必須にする。
alter table public.inquiries add column if not exists owner_consent boolean not null default false;
alter table public.inquiries add column if not exists owner_name text;
-- 登録したときの表示言語（ja/en）。会員への連絡・通知メールの言語に使う。
alter table public.inquiries add column if not exists submit_lang text;

-- Supabase の警告対応: マイグレーション管理表にも RLS を有効化（ポリシー無し=API からは見えない）。
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    execute 'alter table public.schema_migrations enable row level security';
  end if;
end $$;
