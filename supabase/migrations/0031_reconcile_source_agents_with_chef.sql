-- Keep one independently scheduled discovery agent per catalog target.
-- brave_web is the shared search provider used by the Chef Agent, not a target.

alter table public.site_search_agents
  drop constraint if exists site_search_agents_host_key;

create or replace function public.reconcile_site_search_agent_fleet()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  reconciled int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  with catalog_targets as (
    select
      source.key as source_key,
      regexp_replace(
        lower(split_part(split_part(source.base_url, '://', 2), '/', 1)),
        '^www\.',
        ''
      ) as host,
      greatest(480, source.min_interval_minutes) as interval_minutes,
      least(100, source.jitter_percent) as jitter_percent,
      case
        when source.catalog_status in ('blocked', 'retired') then 'blocked'
        else 'pending_activation'
      end as initial_status
    from public.market_sources source
    where source.enabled = true
      and source.key <> 'brave_web'
      and source.base_url is not null
  )
  insert into public.site_search_agents (
    source_key,
    host,
    interval_minutes,
    jitter_percent,
    status
  )
  select
    target.source_key,
    target.host,
    target.interval_minutes,
    target.jitter_percent,
    target.initial_status
  from catalog_targets target
  where target.host <> ''
  on conflict (source_key) do update
  set host = excluded.host,
      interval_minutes = excluded.interval_minutes,
      jitter_percent = excluded.jitter_percent;

  get diagnostics reconciled = row_count;
  return reconciled;
end
$$;

revoke all on function public.reconcile_site_search_agent_fleet() from public, anon, authenticated;
grant execute on function public.reconcile_site_search_agent_fleet() to service_role;

