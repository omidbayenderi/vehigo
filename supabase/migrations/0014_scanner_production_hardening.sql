-- Atomic source leases, source health and retryable Telegram delivery.
alter table market_sources
  add column if not exists locked_until timestamptz,
  add column if not exists locked_by text,
  add column if not exists consecutive_failures int not null default 0,
  add column if not exists last_success_at timestamptz;

alter table listing_alerts
  add column if not exists delivery_attempts int not null default 0,
  add column if not exists next_attempt_at timestamptz;

create or replace function claim_due_market_sources(
  p_force boolean default false,
  p_source_key text default null,
  p_worker_id text default null,
  p_lease_minutes int default 10
)
returns setof market_sources
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from market_sources
    where enabled = true
      and method in ('scrape', 'web_search')
      and (p_source_key is null or key = p_source_key)
      and (p_force or next_run_at is null or next_run_at <= now())
      and (locked_until is null or locked_until < now())
    order by coalesce(next_run_at, '-infinity'::timestamptz)
    for update skip locked
  )
  update market_sources source
  set locked_until = now() + make_interval(mins => greatest(1, least(p_lease_minutes, 30))),
      locked_by = coalesce(p_worker_id, gen_random_uuid()::text)
  from candidates
  where source.id = candidates.id
  returning source.*;
end;
$$;

revoke all on function claim_due_market_sources(boolean, text, text, int) from public, anon, authenticated;
grant execute on function claim_due_market_sources(boolean, text, text, int) to service_role;

create index if not exists listing_alerts_delivery_retry_idx
  on listing_alerts (status, next_attempt_at, created_at);
