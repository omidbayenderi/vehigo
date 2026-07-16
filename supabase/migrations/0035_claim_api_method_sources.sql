-- Migration 0034 added 'api' to market_sources_method_check for the Apify
-- connectors, but claim_due_market_sources (0014) still filtered claims to
-- ('scrape','web_search'), so 'api' sources could never be handed to the
-- runner — scheduled and manual scans alike reported "0 direct sources".
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
      and method in ('scrape', 'web_search', 'api')
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
