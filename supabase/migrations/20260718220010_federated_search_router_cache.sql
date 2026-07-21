-- Cost-aware federated web-search routing. Query text is never stored; only an
-- HMAC fingerprint and aggregate execution metrics are retained. Provider
-- result payloads are optional, expire within 24 hours, and are written only
-- when the operator has separately confirmed storage rights for that provider.

create table if not exists public.federated_search_query_receipts (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null,
  search_day date not null,
  intent text not null check (intent in ('specific', 'market')),
  providers_attempted text[] not null default '{}',
  provider_request_count int not null default 0 check (provider_request_count >= 0),
  result_count int not null default 0 check (result_count >= 0),
  cache_hit_count int not null default 0 check (cache_hit_count >= 0),
  execution_count int not null default 1 check (execution_count >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (query_hash, search_day)
);

create index if not exists federated_search_query_receipts_day_idx
  on public.federated_search_query_receipts (search_day desc, execution_count desc);

create table if not exists public.federated_search_result_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('exa', 'tavily', 'vertex', 'brave')),
  query_hash text not null,
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'array'),
  result_count int not null check (result_count between 1 and 20),
  storage_basis text not null check (storage_basis = 'operator_confirmed'),
  expires_at timestamptz not null,
  hit_count int not null default 0 check (hit_count >= 0),
  last_hit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, query_hash),
  check (expires_at <= created_at + interval '24 hours')
);

create index if not exists federated_search_result_cache_expiry_idx
  on public.federated_search_result_cache (expires_at);

alter table public.federated_search_query_receipts enable row level security;
alter table public.federated_search_result_cache enable row level security;

revoke all on public.federated_search_query_receipts from anon, authenticated;
revoke all on public.federated_search_result_cache from anon, authenticated;
grant select, insert, update on public.federated_search_query_receipts to service_role;
grant select, insert, update, delete on public.federated_search_result_cache to service_role;

create or replace function public.record_federated_search_receipt(
  p_query_hash text,
  p_search_day date,
  p_intent text,
  p_providers_attempted text[],
  p_provider_request_count int,
  p_result_count int,
  p_cache_hit boolean
)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.federated_search_query_receipts (
    query_hash, search_day, intent, providers_attempted,
    provider_request_count, result_count, cache_hit_count
  ) values (
    p_query_hash, p_search_day, p_intent, coalesce(p_providers_attempted, '{}'),
    greatest(0, p_provider_request_count), greatest(0, p_result_count),
    case when p_cache_hit then 1 else 0 end
  )
  on conflict (query_hash, search_day) do update set
    providers_attempted = (
      select coalesce(array_agg(distinct provider order by provider), '{}')
      from unnest(public.federated_search_query_receipts.providers_attempted || excluded.providers_attempted) as providers(provider)
    ),
    provider_request_count = public.federated_search_query_receipts.provider_request_count + excluded.provider_request_count,
    result_count = greatest(public.federated_search_query_receipts.result_count, excluded.result_count),
    cache_hit_count = public.federated_search_query_receipts.cache_hit_count + excluded.cache_hit_count,
    execution_count = public.federated_search_query_receipts.execution_count + 1,
    updated_at = now();
$$;

create or replace function public.touch_federated_search_cache(p_cache_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.federated_search_result_cache
  set hit_count = hit_count + 1, last_hit_at = now(), updated_at = now()
  where id = p_cache_id and expires_at > now();
$$;

revoke all on function public.record_federated_search_receipt(text, date, text, text[], int, int, boolean) from public, anon, authenticated;
revoke all on function public.touch_federated_search_cache(uuid) from public, anon, authenticated;
grant execute on function public.record_federated_search_receipt(text, date, text, text[], int, int, boolean) to service_role;
grant execute on function public.touch_federated_search_cache(uuid) to service_role;

-- Keep four query variants per run, but reserve two provider requests for each
-- variant so a primary miss can safely fall back without exceeding the atomic
-- request budget. Nine runs can therefore cover the current 33-query plan even
-- in the worst case (66 provider requests/day; hard ceiling 72).
update public.site_search_agents
set max_queries_per_run = 4,
    max_pages_per_query = 2,
    daily_query_limit = 72,
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
    'transient_search', 'pending_activation', 160, 0, 4, 2, 72
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
