-- Consolidate the per-domain Brave fleet into one budgeted Europe Web Scout.
-- Historical agents are retired rather than deleted so their run/cost audit
-- trail remains intact. Retired rows cannot be claimed and incur no API cost.

update public.site_search_agent_runs run
set status = 'failed',
    request_count = run.reserved_request_count,
    error_code = 'fleet_consolidated',
    error_message = 'Per-domain agent retired during Europe Web Scout consolidation.',
    completed_at = now()
from public.site_search_agents agent
where run.agent_id = agent.id
  and agent.source_key <> 'brave_web'
  and run.status = 'running';

update public.site_search_agents
set status = 'retired',
    processing_mode = 'transient_search',
    locked_until = null,
    locked_by = null,
    lease_token = null,
    reserved_request_count = 0,
    last_error_code = null,
    last_error_message = null
where source_key <> 'brave_web';

insert into public.site_search_agents (
  source_key,
  host,
  provider_key,
  acquisition_mode,
  egress_policy,
  processing_mode,
  status,
  interval_minutes,
  jitter_percent,
  max_queries_per_run,
  max_pages_per_query,
  daily_query_limit,
  daily_request_count,
  daily_budget_date,
  reserved_request_count,
  query_cursor,
  next_run_at
)
values (
  'brave_web',
  'europe.marketplaces',
  'brave_web',
  'web_index',
  'provider_managed',
  'transient_search',
  -- Keep the replacement idle until the application version that understands
  -- the unified source key has been deployed.
  'pending_activation',
  480,
  0,
  4,
  1,
  12,
  0,
  current_date,
  0,
  0,
  now()
)
on conflict (source_key) do update
set host = excluded.host,
    provider_key = excluded.provider_key,
    acquisition_mode = excluded.acquisition_mode,
    egress_policy = excluded.egress_policy,
    processing_mode = excluded.processing_mode,
    status = excluded.status,
    interval_minutes = excluded.interval_minutes,
    jitter_percent = excluded.jitter_percent,
    max_queries_per_run = excluded.max_queries_per_run,
    max_pages_per_query = excluded.max_pages_per_query,
    daily_query_limit = excluded.daily_query_limit,
    daily_request_count = 0,
    daily_budget_date = current_date,
    reserved_request_count = 0,
    query_cursor = 0,
    next_run_at = now(),
    locked_until = null,
    locked_by = null,
    lease_token = null,
    last_error_code = null,
    last_error_message = null;

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
    'transient_search', 'pending_activation', 480, 0, 4, 1, 12
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

create or replace function public.activate_transient_site_search_agent_fleet()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  activated int;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  update public.site_search_agents
  set status = 'retired', locked_until = null, locked_by = null,
      lease_token = null, reserved_request_count = 0
  where source_key <> 'brave_web' and status <> 'retired';

  update public.site_search_agents
  set status = 'active',
      processing_mode = 'transient_search',
      next_run_at = least(next_run_at, now()),
      last_error_code = null,
      last_error_message = null
  where source_key = 'brave_web'
    and status in ('pending_activation', 'paused', 'blocked', 'active');
  get diagnostics activated = row_count;

  update public.market_sources
  set enabled = false,
      notes = concat_ws(' | ', nullif(notes, ''), 'One budgeted Europe Web Scout handles transient web-index discovery; marketplace content is not persisted.')
  where key = 'brave_web';
  return activated;
end
$$;

create or replace function public.activate_site_search_agent_fleet()
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  activated int;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if not exists (
    select 1
    from public.provider_storage_rights_evidence evidence
    where evidence.provider_key = 'brave_web'
      and evidence.revoked_at is null
      and evidence.effective_at <= now()
      and evidence.expires_at > now()
      and array['result_url','result_title','result_snippet','seller_name','derived_listing']::text[]
        <@ evidence.permitted_data_classes
  ) then
    raise exception 'Active Brave storage-rights evidence is required.';
  end if;

  update public.site_search_agents
  set status = 'retired', locked_until = null, locked_by = null,
      lease_token = null, reserved_request_count = 0
  where source_key <> 'brave_web' and status <> 'retired';

  update public.site_search_agents
  set status = 'active',
      processing_mode = 'persistent_search',
      next_run_at = least(next_run_at, now()),
      last_error_code = null,
      last_error_message = null
  where source_key = 'brave_web'
    and status in ('pending_activation', 'paused', 'blocked', 'active');
  get diagnostics activated = row_count;

  update public.market_sources set enabled = false where key = 'brave_web';
  return activated;
end
$$;

revoke all on function public.reconcile_site_search_agent_fleet() from public, anon, authenticated;
revoke all on function public.activate_transient_site_search_agent_fleet() from public, anon, authenticated;
revoke all on function public.activate_site_search_agent_fleet() from public, anon, authenticated;
grant execute on function public.reconcile_site_search_agent_fleet() to service_role;
grant execute on function public.activate_transient_site_search_agent_fleet() to service_role;
grant execute on function public.activate_site_search_agent_fleet() to service_role;
