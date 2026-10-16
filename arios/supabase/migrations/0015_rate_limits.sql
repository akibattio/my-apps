-- 分散対応レート制限（サーバーレスの複数インスタンス間で共有）。
-- 従来はプロセス内メモリで、インスタンスごとに独立していて実質無効だった。
-- このテーブル＋原子的な関数で、全インスタンス共通の制限をかける。

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null default now()
);

-- RLS 有効・ポリシーなし＝service_role 専用（サーバーからのみ更新）。
alter table public.rate_limits enable row level security;

-- 1 回分のアクセスを記録し、上限内なら true を返す（原子的）。
--  p_key       … 制限キー（例: "signup:ip:1.2.3.4"）
--  p_limit     … ウィンドウ内の許容回数
--  p_window_ms … ウィンドウ長（ミリ秒）
create or replace function public.rl_hit(p_key text, p_limit integer, p_window_ms bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_count integer;
begin
  insert into public.rate_limits as r (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update
    set count    = case when r.reset_at < v_now then 1 else r.count + 1 end,
        reset_at = case when r.reset_at < v_now
                        then v_now + make_interval(secs => p_window_ms / 1000.0)
                        else r.reset_at end
  returning r.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- 期限切れ行の掃除用（任意・運用で定期実行可）。
create index if not exists rate_limits_reset_at_idx on public.rate_limits (reset_at);
