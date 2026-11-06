-- H-1 対策: レート制限関数 rl_hit を service_role 専用にし、引数を安全な範囲に制限する。
-- 旧 0015 では rl_hit(SECURITY DEFINER) の EXECUTE が PUBLIC/anon/authenticated に付いたままで、
-- 公開RPCから誰でも呼べてDB肥大化や特定キーの事前上限超過(登録妨害)が可能だった。

-- 引数を安全な範囲にクランプし直す（キー長・limit・window をガード）。
create or replace function public.rl_hit(p_key text, p_limit integer, p_window_ms bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_count  integer;
  v_key    text    := left(coalesce(p_key, 'unknown'), 200);
  v_limit  integer := least(greatest(coalesce(p_limit, 1), 1), 100000);
  v_window bigint  := least(greatest(coalesce(p_window_ms, 60000), 1000), 86400000);
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (v_key, 1, v_now + make_interval(secs => v_window / 1000.0))
  on conflict (key) do update
    set count    = case when r.reset_at < v_now then 1 else r.count + 1 end,
        reset_at = case when r.reset_at < v_now
                        then v_now + make_interval(secs => v_window / 1000.0)
                        else r.reset_at end
  returning r.count into v_count;

  return v_count <= v_limit;
end;
$$;

-- 実行権限を service_role だけに限定（CREATE OR REPLACE 後に再付与されるPUBLICを剥奪）。
revoke all on function public.rl_hit(text, integer, bigint) from public;
revoke all on function public.rl_hit(text, integer, bigint) from anon;
revoke all on function public.rl_hit(text, integer, bigint) from authenticated;
grant execute on function public.rl_hit(text, integer, bigint) to service_role;
