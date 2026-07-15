-- Phase 7 / Wave 2: compliant, leased site-specific search-agent fleet.
-- This migration is additive-first. The existing Brave source remains enabled
-- until the new application explicitly activates the fleet after validating its
-- provider configuration.

create table if not exists public.provider_storage_rights_evidence (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  contract_reference text not null check (nullif(btrim(contract_reference), '') is not null),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  permitted_data_classes text[] not null,
  permitted_territories text[] not null,
  retention_days int not null check (retention_days > 0),
  effective_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > effective_at),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider_key, evidence_sha256)
);

create table if not exists public.site_search_agents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique references public.market_sources(key) on delete cascade,
  host text not null unique check (host ~ '^[a-z0-9.-]+$' and host not like '.%' and host not like '%.'),
  provider_key text not null default 'brave_web' check (provider_key = 'brave_web'),
  acquisition_mode text not null default 'web_index' check (acquisition_mode = 'web_index'),
  egress_policy text not null default 'provider_managed' check (egress_policy = 'provider_managed'),
  status text not null default 'pending_activation' check (status in ('pending_activation','active','paused','blocked','retired')),
  interval_minutes int not null default 480 check (interval_minutes between 15 and 10080),
  jitter_percent int not null default 20 check (jitter_percent between 0 and 100),
  max_queries_per_run int not null default 4 check (max_queries_per_run between 1 and 30),
  max_pages_per_query int not null default 2 check (max_pages_per_query between 1 and 10),
  daily_query_limit int not null default 48 check (daily_query_limit between 1 and 1000),
  daily_request_count int not null default 0 check (daily_request_count between 0 and 1000),
  daily_budget_date date not null default current_date,
  reserved_request_count int not null default 0 check (reserved_request_count between 0 and 300),
  query_cursor int not null default 0 check (query_cursor >= 0),
  next_run_at timestamptz not null default now(),
  locked_until timestamptz,
  locked_by text,
  lease_token uuid,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_success_at timestamptz,
  last_status text check (last_status is null or last_status in ('ok','partial','failed','blocked','skipped')),
  last_error_code text,
  last_error_message text,
  consecutive_failures int not null default 0 check (consecutive_failures >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (locked_by is null and locked_until is null and lease_token is null and reserved_request_count = 0)
    or
    (locked_by is not null and locked_until is not null and lease_token is not null and reserved_request_count > 0)
  )
);

create table if not exists public.site_search_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.site_search_agents(id) on delete cascade,
  source_key text not null,
  correlation_id uuid not null default gen_random_uuid(),
  worker_id text not null,
  lease_token uuid not null,
  status text not null check (status in ('running','ok','partial','failed','blocked','skipped')),
  reserved_request_count int not null check (reserved_request_count > 0),
  request_count int not null default 0 check (request_count >= 0 and request_count <= reserved_request_count),
  query_count int not null default 0 check (query_count >= 0),
  page_count int not null default 0 check (page_count >= 0),
  fetched_count int not null default 0 check (fetched_count >= 0),
  inserted_count int not null default 0 check (inserted_count >= 0),
  alerts_created int not null default 0 check (alerts_created >= 0),
  cursor_before int not null default 0 check (cursor_before >= 0),
  cursor_after int not null default 0 check (cursor_after >= 0),
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- A failed/older 0027 attempt may have created the tables before the seed
-- statement rolled forward. Reconcile that draft schema before inserting data
-- so this migration is safe to run again from the Supabase SQL Editor.
alter table public.site_search_agents
  add column if not exists daily_request_count int not null default 0,
  add column if not exists daily_budget_date date not null default current_date,
  add column if not exists reserved_request_count int not null default 0,
  add column if not exists lease_token uuid;

update public.site_search_agents
set locked_until = null,
    locked_by = null,
    lease_token = null,
    reserved_request_count = 0
where locked_until is not null
   or locked_by is not null
   or lease_token is not null
   or reserved_request_count <> 0;

alter table public.site_search_agents
  alter column status set default 'pending_activation';
alter table public.site_search_agents
  drop constraint if exists site_search_agents_status_check;
alter table public.site_search_agents
  add constraint site_search_agents_status_check
  check (status in ('pending_activation','active','paused','blocked','retired'));
alter table public.site_search_agents
  drop constraint if exists site_search_agents_lease_consistency_check;
alter table public.site_search_agents
  add constraint site_search_agents_lease_consistency_check
  check (
    (locked_by is null and locked_until is null and lease_token is null and reserved_request_count = 0)
    or
    (locked_by is not null and locked_until is not null and lease_token is not null and reserved_request_count > 0)
  );

alter table public.site_search_agent_runs
  add column if not exists worker_id text,
  add column if not exists lease_token uuid,
  add column if not exists reserved_request_count int,
  add column if not exists request_count int not null default 0;

update public.site_search_agent_runs
set worker_id = coalesce(worker_id, 'migration-recovery'),
    lease_token = coalesce(lease_token, gen_random_uuid()),
    reserved_request_count = coalesce(reserved_request_count, greatest(1, request_count)),
    status = case when status = 'running' then 'failed' else status end,
    error_code = case when status = 'running' then 'migration_recovery' else error_code end,
    error_message = case when status = 'running' then 'Recovered from an incomplete 0027 migration.' else error_message end,
    completed_at = case when status = 'running' then now() else completed_at end
where worker_id is null
   or lease_token is null
   or reserved_request_count is null
   or status = 'running';

alter table public.site_search_agent_runs
  alter column worker_id set not null,
  alter column lease_token set not null,
  alter column reserved_request_count set not null;
alter table public.site_search_agent_runs
  drop constraint if exists site_search_agent_runs_status_check;
alter table public.site_search_agent_runs
  add constraint site_search_agent_runs_status_check
  check (status in ('running','ok','partial','failed','blocked','skipped'));
alter table public.site_search_agent_runs
  drop constraint if exists site_search_agent_runs_request_budget_check;
alter table public.site_search_agent_runs
  add constraint site_search_agent_runs_request_budget_check
  check (request_count >= 0 and request_count <= reserved_request_count);

drop trigger if exists site_search_agents_set_updated_at on public.site_search_agents;
create trigger site_search_agents_set_updated_at
  before update on public.site_search_agents
  for each row execute function public.set_updated_at();

create index if not exists site_search_agents_due_idx
  on public.site_search_agents (next_run_at, consecutive_failures, source_key)
  where status = 'active';
create index if not exists site_search_agent_runs_agent_started_idx
  on public.site_search_agent_runs (agent_id, started_at desc);
create index if not exists site_search_agent_runs_correlation_idx
  on public.site_search_agent_runs (correlation_id);
create index if not exists listing_alerts_pending_digest_idx
  on public.listing_alerts (opportunity_score desc nulls last, created_at)
  where status = 'pending' and sent_at is null;

alter table public.listing_alerts
  add column if not exists digest_claim_token uuid,
  add column if not exists digest_claimed_until timestamptz;

create index if not exists listing_alerts_digest_claim_idx
  on public.listing_alerts (digest_claimed_until, opportunity_score desc nulls last, created_at)
  where status = 'pending' and sent_at is null;

-- One canonical agent is created per normalized host. Legacy source aliases such
-- as wallapop/wallapop_es cannot violate the unique host constraint.
with normalized_sources as (
  select
    source.*,
    regexp_replace(lower(split_part(split_part(source.base_url, '://', 2), '/', 1)), '^www\.', '') as normalized_host
  from public.market_sources source
  where source.base_url is not null
    and source.key not in ('brave_web','facebook_public','telegram_public')
), ranked_sources as (
  select
    normalized_sources.*,
    row_number() over (
      partition by normalized_host
      order by case when key = 'wallapop_es' then 0 else 1 end, key
    ) as host_rank
  from normalized_sources
  where normalized_host <> ''
)
insert into public.site_search_agents (
  source_key,
  host,
  interval_minutes,
  jitter_percent,
  status
)
select
  source.key,
  source.normalized_host,
  greatest(480, source.min_interval_minutes),
  least(100, source.jitter_percent),
  case when source.catalog_status in ('blocked','retired') then 'blocked' else 'pending_activation' end
from ranked_sources source
where source.host_rank = 1
on conflict (source_key) do update
set host = excluded.host,
    interval_minutes = excluded.interval_minutes,
    jitter_percent = excluded.jitter_percent;

-- Direct Marktplaats HTML retrieval stays disabled; its canonical web-index
-- agent remains paused until the provider-backed fleet is activated.
update public.market_sources
set method = 'email_alert',
    acquisition_modes = array['web_index','saved_search_email'],
    connector_version = null,
    connector_capabilities = jsonb_build_object(
      'direct_search', false,
      'incremental_sync', false,
      'permission_status', 'unverified',
      'replacement', 'site_search_agent'
    ),
    notes = concat_ws(' | ', nullif(notes, ''), 'Direct HTML disabled until explicit written permission is recorded; web-index agent remains available.')
where key = 'marktplaats';

alter table public.site_search_agents enable row level security;
alter table public.site_search_agent_runs enable row level security;
alter table public.provider_storage_rights_evidence enable row level security;

drop policy if exists "provider rights evidence readable by platform admins" on public.provider_storage_rights_evidence;
create policy "provider rights evidence readable by platform admins"
  on public.provider_storage_rights_evidence for select
  using (public.is_platform_admin());
drop policy if exists "provider rights evidence manageable by platform admins" on public.provider_storage_rights_evidence;
drop policy if exists "provider rights evidence insertable by platform admins" on public.provider_storage_rights_evidence;
create policy "provider rights evidence insertable by platform admins"
  on public.provider_storage_rights_evidence for insert
  with check (public.is_platform_admin() and approved_by = auth.uid());
drop policy if exists "provider rights evidence revocable by platform admins" on public.provider_storage_rights_evidence;
create policy "provider rights evidence revocable by platform admins"
  on public.provider_storage_rights_evidence for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create or replace function public.guard_provider_storage_rights_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Provider storage-rights evidence is append-only.';
  end if;
  if new.provider_key is distinct from old.provider_key
     or new.contract_reference is distinct from old.contract_reference
     or new.evidence_sha256 is distinct from old.evidence_sha256
     or new.permitted_data_classes is distinct from old.permitted_data_classes
     or new.permitted_territories is distinct from old.permitted_territories
     or new.retention_days is distinct from old.retention_days
     or new.effective_at is distinct from old.effective_at
     or new.expires_at is distinct from old.expires_at
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.created_at is distinct from old.created_at
     or old.revoked_at is not null
     or new.revoked_at is null then
    raise exception 'Provider storage-rights evidence is immutable except for one-way revocation.';
  end if;
  return new;
end
$$;

drop trigger if exists provider_storage_rights_evidence_guard on public.provider_storage_rights_evidence;
create trigger provider_storage_rights_evidence_guard
  before update or delete on public.provider_storage_rights_evidence
  for each row execute function public.guard_provider_storage_rights_evidence();

drop policy if exists "site search agents readable by platform admins" on public.site_search_agents;
create policy "site search agents readable by platform admins"
  on public.site_search_agents for select
  using (public.is_platform_admin());
drop policy if exists "site search agents manageable by platform admins" on public.site_search_agents;
create policy "site search agents manageable by platform admins"
  on public.site_search_agents for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
drop policy if exists "site search agent runs readable by platform admins" on public.site_search_agent_runs;
create policy "site search agent runs readable by platform admins"
  on public.site_search_agent_runs for select
  using (public.is_platform_admin());

-- Activation is deliberately an operator-only, one-time action. Scanner runtime
-- never calls it, so an operational pause cannot be silently undone.
create or replace function public.activate_site_search_agent_fleet()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  activated int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
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
  set status = 'active',
      next_run_at = least(next_run_at, now()),
      last_error_code = null,
      last_error_message = null
  where status = 'pending_activation';
  get diagnostics activated = row_count;

  update public.market_sources
  set enabled = false,
      notes = case
        when coalesce(notes, '') like '%scheduling moved to site_search_agents%'
          then notes
        else concat_ws(' | ', nullif(notes, ''), 'Provider runtime retained; scheduling moved to site_search_agents.')
      end
  where key = 'brave_web';

  return activated;
end
$$;

create or replace function public.claim_due_site_search_agents(
  p_worker_id text,
  p_limit int default 1,
  p_lease_seconds int default 300,
  p_source_key text default null
)
returns setof public.site_search_agents
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'Worker ID is required.';
  end if;
  if p_limit <> 1 then
    raise exception 'This synchronous claim API requires p_limit = 1.';
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
    update public.site_search_agent_runs run
    set status = 'blocked',
        request_count = run.reserved_request_count,
        error_code = 'storage_rights_unverified',
        error_message = 'Active Brave storage-rights evidence is missing, expired, or revoked.',
        completed_at = now()
    from public.site_search_agents agent
    where run.agent_id = agent.id
      and run.status = 'running'
      and run.lease_token = agent.lease_token
      and agent.status = 'active';

    update public.site_search_agents
    set status = 'blocked',
        last_status = 'blocked',
        last_error_code = 'storage_rights_unverified',
        last_error_message = 'Active Brave storage-rights evidence is missing, expired, or revoked.',
        locked_until = null,
        locked_by = null,
        lease_token = null,
        reserved_request_count = 0
    where status = 'active';
    return;
  end if;

  -- A crashed worker is charged its full reservation (safe upper bound) and its
  -- abandoned run is made terminal before the agent can receive a new lease.
  update public.site_search_agent_runs run
  set status = 'failed',
      request_count = run.reserved_request_count,
      error_code = 'lease_expired',
      error_message = 'Worker lease expired before terminal completion.',
      completed_at = now()
  from public.site_search_agents agent
  where run.agent_id = agent.id
    and run.status = 'running'
    and run.lease_token = agent.lease_token
    and agent.locked_until <= now();

  -- A synchronous invocation claims exactly one agent. This keeps provider work
  -- below the route and lease budgets and prevents later claims waiting in-process.
  return query
  with candidates as (
    select
      agent.id,
      gen_random_uuid() as next_lease_token,
      least(
        agent.max_queries_per_run * agent.max_pages_per_query,
        agent.daily_query_limit - case
          when agent.daily_budget_date = current_date then agent.daily_request_count
          else 0
        end,
        4
      )::int as reservation
    from public.site_search_agents agent
    where agent.status = 'active'
      and agent.next_run_at <= now()
      and (agent.locked_until is null or agent.locked_until <= now())
      and (p_source_key is null or agent.source_key = p_source_key)
      and (
        case when agent.daily_budget_date = current_date then agent.daily_request_count else 0 end
      ) < agent.daily_query_limit
    order by agent.next_run_at, agent.consecutive_failures, agent.source_key
    for update skip locked
    limit 1
  )
  update public.site_search_agents agent
  set locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 900))),
      lease_token = candidates.next_lease_token,
      reserved_request_count = candidates.reservation,
      daily_budget_date = current_date,
      daily_request_count = case
        when agent.daily_budget_date = current_date then agent.daily_request_count
        else 0
      end + candidates.reservation,
      last_started_at = now()
  from candidates
  where agent.id = candidates.id
    and candidates.reservation > 0
  returning agent.*;
end
$$;

create or replace function public.claim_opportunity_digest_alerts(
  p_claim_token uuid,
  p_limit int default 1000,
  p_user_id uuid default null,
  p_lease_seconds int default 300
)
returns setof public.listing_alerts
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_claim_token is null then
    raise exception 'Digest claim token is required.';
  end if;

  return query
  with candidates as (
    select alert.id
    from public.listing_alerts alert
    where alert.status = 'pending'
      and alert.sent_at is null
      and (alert.next_attempt_at is null or alert.next_attempt_at <= now())
      and (alert.digest_claimed_until is null or alert.digest_claimed_until <= now())
      and (p_user_id is null or alert.user_id = p_user_id)
    order by alert.opportunity_score desc nulls last, alert.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 1000))
  )
  update public.listing_alerts alert
  set digest_claim_token = p_claim_token,
      digest_claimed_until = now() + make_interval(secs => greatest(60, least(p_lease_seconds, 900)))
  from candidates
  where alert.id = candidates.id
  returning alert.*;
end
$$;

create or replace function public.finish_opportunity_digest_alerts(
  p_claim_token uuid,
  p_alert_ids uuid[],
  p_sent boolean,
  p_error text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  finished int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  update public.listing_alerts alert
  set status = case when p_sent then 'sent' else 'pending' end,
      sent_at = case when p_sent then now() else null end,
      error = case when p_sent then null else left(coalesce(p_error, 'Digest delivery failed'), 1000) end,
      delivery_attempts = alert.delivery_attempts + 1,
      next_attempt_at = case when p_sent then null else now() + interval '15 minutes' end,
      digest_claim_token = null,
      digest_claimed_until = null
  where alert.id = any(coalesce(p_alert_ids, array[]::uuid[]))
    and alert.status = 'pending'
    and alert.sent_at is null
    and alert.digest_claim_token = p_claim_token;
  get diagnostics finished = row_count;
  return finished;
end
$$;

create or replace function public.mark_opportunity_digest_uncertain(
  p_claim_token uuid,
  p_alert_ids uuid[],
  p_error text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  marked int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  update public.listing_alerts alert
  set status = 'failed',
      error = left('delivery_uncertain: ' || coalesce(p_error, 'Telegram accepted the message but database completion was ambiguous.'), 1000),
      delivery_attempts = alert.delivery_attempts + 1,
      next_attempt_at = null,
      digest_claim_token = null,
      digest_claimed_until = null
  where alert.id = any(coalesce(p_alert_ids, array[]::uuid[]))
    and alert.status = 'pending'
    and alert.sent_at is null
    and alert.digest_claim_token = p_claim_token;
  get diagnostics marked = row_count;
  return marked;
end
$$;

create or replace function public.start_site_search_agent_run(
  p_agent_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  agent public.site_search_agents;
  run_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  select * into agent
  from public.site_search_agents
  where id = p_agent_id
  for update;

  if agent.id is null
     or agent.locked_by is distinct from p_worker_id
     or agent.lease_token is distinct from p_lease_token
     or agent.locked_until <= now()
     or agent.reserved_request_count <= 0 then
    raise exception 'Stale or invalid site-agent lease.';
  end if;

  insert into public.site_search_agent_runs (
    agent_id, source_key, correlation_id, worker_id, lease_token, status,
    reserved_request_count, cursor_before, cursor_after
  ) values (
    agent.id, agent.source_key, p_correlation_id, p_worker_id, p_lease_token,
    'running', agent.reserved_request_count, agent.query_cursor, agent.query_cursor
  ) returning id into run_id;

  return run_id;
end
$$;

create or replace function public.finish_site_search_agent_run(
  p_run_id uuid,
  p_agent_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_status text,
  p_request_count int,
  p_query_count int,
  p_page_count int,
  p_fetched_count int,
  p_inserted_count int,
  p_alerts_created int,
  p_cursor_after int,
  p_next_run_at timestamptz,
  p_error_code text default null,
  p_error_message text default null,
  p_block_agent boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  agent public.site_search_agents;
  run public.site_search_agent_runs;
  v_completed_at timestamptz := now();
  unused_reservation int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_status not in ('ok','partial','failed','blocked','skipped') then
    raise exception 'Invalid terminal site-agent status.';
  end if;

  select * into agent
  from public.site_search_agents
  where id = p_agent_id
  for update;
  select * into run
  from public.site_search_agent_runs
  where id = p_run_id and agent_id = p_agent_id
  for update;

  if agent.id is null
     or run.id is null
     or run.status <> 'running'
     or agent.locked_by is distinct from p_worker_id
     or agent.lease_token is distinct from p_lease_token
     or run.worker_id is distinct from p_worker_id
     or run.lease_token is distinct from p_lease_token
     or agent.locked_until <= v_completed_at then
    raise exception 'Stale or invalid site-agent completion.';
  end if;
  if p_request_count < 0 or p_request_count > run.reserved_request_count then
    raise exception 'Request count exceeds reserved budget.';
  end if;

  unused_reservation := run.reserved_request_count - p_request_count;

  update public.site_search_agent_runs
  set status = p_status,
      request_count = p_request_count,
      query_count = greatest(0, p_query_count),
      page_count = greatest(0, p_page_count),
      fetched_count = greatest(0, p_fetched_count),
      inserted_count = greatest(0, p_inserted_count),
      alerts_created = greatest(0, p_alerts_created),
      cursor_after = greatest(0, p_cursor_after),
      error_code = p_error_code,
      error_message = left(p_error_message, 1000),
      completed_at = v_completed_at
  where id = run.id;

  update public.site_search_agents
  set status = case when p_block_agent then 'blocked' else agent.status end,
      query_cursor = case when p_status in ('ok','partial') then greatest(0, p_cursor_after) else agent.query_cursor end,
      next_run_at = p_next_run_at,
      locked_until = null,
      locked_by = null,
      lease_token = null,
      reserved_request_count = 0,
      daily_request_count = case
        when daily_budget_date = current_date then greatest(0, daily_request_count - unused_reservation)
        else daily_request_count
      end,
      last_completed_at = v_completed_at,
      last_success_at = case when p_status in ('ok','partial') then v_completed_at else agent.last_success_at end,
      last_status = p_status,
      last_error_code = p_error_code,
      last_error_message = left(p_error_message, 1000),
      consecutive_failures = case when p_status in ('ok','partial') then 0 else agent.consecutive_failures + 1 end
  where id = agent.id;

  return true;
end
$$;

revoke all on function public.activate_site_search_agent_fleet() from public, anon, authenticated;
revoke all on function public.guard_provider_storage_rights_evidence() from public, anon, authenticated;
revoke all on function public.claim_due_site_search_agents(text, int, int, text) from public, anon, authenticated;
revoke all on function public.start_site_search_agent_run(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_site_search_agent_run(uuid, uuid, text, uuid, text, int, int, int, int, int, int, int, timestamptz, text, text, boolean) from public, anon, authenticated;
revoke all on function public.claim_opportunity_digest_alerts(uuid, int, uuid, int) from public, anon, authenticated;
revoke all on function public.finish_opportunity_digest_alerts(uuid, uuid[], boolean, text) from public, anon, authenticated;
revoke all on function public.mark_opportunity_digest_uncertain(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.activate_site_search_agent_fleet() to service_role;
grant execute on function public.claim_due_site_search_agents(text, int, int, text) to service_role;
grant execute on function public.start_site_search_agent_run(uuid, text, uuid, uuid) to service_role;
grant execute on function public.finish_site_search_agent_run(uuid, uuid, text, uuid, text, int, int, int, int, int, int, int, timestamptz, text, text, boolean) to service_role;
grant execute on function public.claim_opportunity_digest_alerts(uuid, int, uuid, int) to service_role;
grant execute on function public.finish_opportunity_digest_alerts(uuid, uuid[], boolean, text) to service_role;
grant execute on function public.mark_opportunity_digest_uncertain(uuid, uuid[], text) to service_role;
