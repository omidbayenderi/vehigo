-- Nine 160-minute discovery windows per day. Four one-page Brave queries per
-- window cover the current 29-query watchlist plan once per day with headroom.
-- At the hard limit this is 36 requests/day (1,080 in a 30-day month).

update public.site_search_agents
set interval_minutes = 160,
    jitter_percent = 0,
    max_queries_per_run = 4,
    max_pages_per_query = 1,
    daily_query_limit = 36,
    next_run_at = least(next_run_at, now()),
    updated_at = now()
where source_key = 'brave_web';

create or replace function public.reconcile_site_search_agent_fleet()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  update public.site_search_agents
  set status = 'retired',
      processing_mode = 'transient_search',
      locked_until = null,
      locked_by = null,
      lease_token = null,
      reserved_request_count = 0
  where source_key <> 'brave_web'
    and status <> 'retired';

  insert into public.site_search_agents (
    source_key, host, provider_key, acquisition_mode, egress_policy,
    processing_mode, status, interval_minutes, jitter_percent,
    max_queries_per_run, max_pages_per_query, daily_query_limit
  )
  values (
    'brave_web', 'europe.marketplaces', 'brave_web', 'web_index', 'provider_managed',
    'transient_search', 'pending_activation', 160, 0, 4, 1, 36
  )
  on conflict (source_key) do update
  set host = excluded.host,
      provider_key = excluded.provider_key,
      acquisition_mode = excluded.acquisition_mode,
      egress_policy = excluded.egress_policy,
      interval_minutes = excluded.interval_minutes,
      jitter_percent = excluded.jitter_percent,
      max_queries_per_run = excluded.max_queries_per_run,
      max_pages_per_query = excluded.max_pages_per_query,
      daily_query_limit = excluded.daily_query_limit;

  return 1;
end
$$;

revoke all on function public.reconcile_site_search_agent_fleet() from public, anon, authenticated;
grant execute on function public.reconcile_site_search_agent_fleet() to service_role;
