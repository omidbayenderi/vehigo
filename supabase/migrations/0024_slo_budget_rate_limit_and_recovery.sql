create table if not exists public.operation_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  alert_type text not null check (alert_type in ('slo_breach', 'budget_soft', 'budget_hard', 'rate_limit', 'dead_letter', 'recovery_drill')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  title text not null check (char_length(title) between 1 and 200),
  details jsonb not null default '{}'::jsonb,
  occurrence_count int not null default 1 check (occurrence_count > 0),
  first_occurred_at timestamptz not null default now(),
  last_occurred_at timestamptz not null default now(),
  acknowledged_by uuid references public.users_profile(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);

create table if not exists public.provider_slo_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null check (provider_key ~ '^[A-Za-z0-9._:-]{1,120}$'),
  operation_type text not null check (operation_type ~ '^[a-z][a-z0-9._-]{0,119}$'),
  target_availability_percent numeric(6,3) not null check (target_availability_percent between 0 and 100),
  max_error_rate_percent numeric(6,3) not null check (max_error_rate_percent between 0 and 100),
  max_p95_latency_ms int not null check (max_p95_latency_ms between 1 and 3600000),
  window_minutes int not null default 60 check (window_minutes between 1 and 43200),
  minimum_samples int not null default 20 check (minimum_samples between 1 and 1000000),
  enabled boolean not null default true,
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_key, operation_type)
);

create table if not exists public.provider_observations (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null,
  operation_type text not null,
  outcome text not null check (outcome in ('success', 'failure', 'timeout', 'rejected')),
  duration_ms int not null check (duration_ms >= 0),
  correlation_id uuid not null,
  job_id uuid references public.operation_jobs(id) on delete set null,
  error_code text,
  cost_amount numeric(18,6) check (cost_amount is null or cost_amount >= 0),
  cost_currency text check (cost_currency is null or cost_currency ~ '^[A-Z]{3}$'),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '90 days')
);

create table if not exists public.usage_budget_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_key text not null check (budget_key ~ '^[a-z][a-z0-9._-]{0,119}$'),
  period text not null check (period in ('daily', 'monthly')),
  unit text not null check (unit ~ '^[A-Za-z][A-Za-z0-9._-]{0,39}$'),
  soft_limit numeric(20,6) not null check (soft_limit >= 0),
  hard_limit numeric(20,6) not null check (hard_limit > 0 and hard_limit >= soft_limit),
  enforcement text not null default 'block' check (enforcement in ('warn', 'block')),
  enabled boolean not null default true,
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, budget_key)
);

create table if not exists public.usage_ledger (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_key text not null,
  amount numeric(20,6) not null check (amount > 0),
  unit text not null,
  cost_amount numeric(18,6) check (cost_amount is null or cost_amount >= 0),
  cost_currency text check (cost_currency is null or cost_currency ~ '^[A-Z]{3}$'),
  correlation_id uuid not null,
  job_id uuid references public.operation_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '400 days')
);

create table if not exists public.rate_limit_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  limit_key text not null check (limit_key ~ '^[a-z][a-z0-9._-]{0,119}$'),
  window_seconds int not null check (window_seconds between 1 and 86400),
  max_requests int not null check (max_requests between 1 and 100000000),
  enabled boolean not null default true,
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, limit_key)
);

create table if not exists public.rate_limit_counters (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  limit_key text not null,
  subject_key text not null check (char_length(subject_key) between 1 and 200),
  window_started_at timestamptz not null,
  request_count int not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, limit_key, subject_key, window_started_at)
);

create table if not exists public.recovery_drills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  drill_type text not null check (drill_type in ('backup_restore', 'provider_outage', 'queue_recovery', 'credential_rotation', 'data_retention')),
  status text not null default 'planned' check (status in ('planned', 'running', 'passed', 'failed', 'cancelled')),
  scope text not null check (char_length(scope) between 3 and 1000),
  evidence jsonb not null default '{}'::jsonb,
  planned_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.users_profile(id) on delete restrict,
  reviewed_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is not null)
);

drop trigger if exists operation_alerts_set_updated_at on public.operation_alerts;
create trigger operation_alerts_set_updated_at before update on public.operation_alerts for each row execute function public.set_updated_at();
drop trigger if exists provider_slo_policies_set_updated_at on public.provider_slo_policies;
create trigger provider_slo_policies_set_updated_at before update on public.provider_slo_policies for each row execute function public.set_updated_at();
drop trigger if exists usage_budget_policies_set_updated_at on public.usage_budget_policies;
create trigger usage_budget_policies_set_updated_at before update on public.usage_budget_policies for each row execute function public.set_updated_at();
drop trigger if exists rate_limit_policies_set_updated_at on public.rate_limit_policies;
create trigger rate_limit_policies_set_updated_at before update on public.rate_limit_policies for each row execute function public.set_updated_at();
drop trigger if exists recovery_drills_set_updated_at on public.recovery_drills;
create trigger recovery_drills_set_updated_at before update on public.recovery_drills for each row execute function public.set_updated_at();

create index if not exists provider_observations_window_idx on public.provider_observations (organization_id, provider_key, operation_type, occurred_at desc);
create index if not exists provider_observations_retention_idx on public.provider_observations (retention_until);
create index if not exists usage_ledger_period_idx on public.usage_ledger (organization_id, budget_key, occurred_at desc);
create index if not exists usage_ledger_retention_idx on public.usage_ledger (retention_until);
create index if not exists operation_alerts_status_idx on public.operation_alerts (organization_id, status, severity, last_occurred_at desc);
create index if not exists recovery_drills_schedule_idx on public.recovery_drills (organization_id, status, planned_for);

alter table public.operation_alerts enable row level security;
alter table public.provider_slo_policies enable row level security;
alter table public.provider_observations enable row level security;
alter table public.usage_budget_policies enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.rate_limit_policies enable row level security;
alter table public.rate_limit_counters enable row level security;
alter table public.recovery_drills enable row level security;

create policy "operation alerts readable by members" on public.operation_alerts for select using (public.is_organization_member(organization_id));
create policy "operation alerts manageable by owners" on public.operation_alerts for update using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']));
create policy "slo policies readable by members" on public.provider_slo_policies for select using (public.is_organization_member(organization_id));
create policy "slo policies manageable by owners" on public.provider_slo_policies for all using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']));
create policy "provider observations readable by members" on public.provider_observations for select using (public.is_organization_member(organization_id));
create policy "budget policies readable by members" on public.usage_budget_policies for select using (public.is_organization_member(organization_id));
create policy "budget policies manageable by owners" on public.usage_budget_policies for all using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']));
create policy "usage ledger readable by owners" on public.usage_ledger for select using (public.is_organization_member(organization_id, array['owner']));
create policy "rate limit policies readable by members" on public.rate_limit_policies for select using (public.is_organization_member(organization_id));
create policy "rate limit policies manageable by owners" on public.rate_limit_policies for all using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']));
create policy "rate limit counters readable by owners" on public.rate_limit_counters for select using (public.is_organization_member(organization_id, array['owner']));
create policy "recovery drills readable by members" on public.recovery_drills for select using (public.is_organization_member(organization_id));
create policy "recovery drills manageable by owners" on public.recovery_drills for all using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']) and created_by = auth.uid());

create or replace function public.consume_rate_limit(p_organization_id uuid, p_limit_key text, p_subject_key text, p_units int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.rate_limit_policies;
  window_start timestamptz;
  current_count int;
  remaining int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  if p_units < 1 or p_units > 1000000 then raise exception 'Invalid rate-limit units.'; end if;
  select * into policy_row from public.rate_limit_policies where organization_id = p_organization_id and limit_key = p_limit_key and enabled = true;
  if policy_row.id is null then return jsonb_build_object('configured', false, 'allowed', true, 'remaining', null, 'retry_after_seconds', 0); end if;
  window_start := to_timestamp(floor(extract(epoch from now()) / policy_row.window_seconds) * policy_row.window_seconds);
  insert into public.rate_limit_counters (organization_id, limit_key, subject_key, window_started_at, request_count)
  values (p_organization_id, p_limit_key, left(p_subject_key, 200), window_start, p_units)
  on conflict (organization_id, limit_key, subject_key, window_started_at)
  do update set request_count = public.rate_limit_counters.request_count + excluded.request_count, updated_at = now()
  returning request_count into current_count;
  remaining := greatest(0, policy_row.max_requests - current_count);
  if current_count > policy_row.max_requests then
    insert into public.operation_alerts (organization_id, dedupe_key, alert_type, severity, title, details)
    values (p_organization_id, 'rate_limit:' || p_limit_key || ':' || left(p_subject_key, 80), 'rate_limit', 'warning', 'Rate limit exceeded: ' || p_limit_key, jsonb_build_object('subject', left(p_subject_key, 200), 'count', current_count, 'limit', policy_row.max_requests, 'window_seconds', policy_row.window_seconds))
    on conflict (organization_id, dedupe_key) do update set status = 'open', details = excluded.details, occurrence_count = public.operation_alerts.occurrence_count + 1, last_occurred_at = now(), resolved_at = null;
  end if;
  return jsonb_build_object('configured', true, 'allowed', current_count <= policy_row.max_requests, 'remaining', remaining, 'retry_after_seconds', greatest(0, policy_row.window_seconds - floor(extract(epoch from (now() - window_start)))::int));
end
$$;

create or replace function public.consume_usage_budget(p_organization_id uuid, p_budget_key text, p_amount numeric, p_unit text, p_correlation_id uuid, p_job_id uuid default null, p_cost_amount numeric default null, p_cost_currency text default null, p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.usage_budget_policies;
  period_start timestamptz;
  used_amount numeric;
  projected numeric;
  allowed boolean := true;
  alert_kind text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  if p_amount <= 0 then raise exception 'Usage amount must be positive.'; end if;
  select * into policy_row from public.usage_budget_policies where organization_id = p_organization_id and budget_key = p_budget_key and enabled = true for update;
  if policy_row.id is not null and policy_row.unit <> p_unit then raise exception 'Usage unit does not match budget policy.'; end if;
  period_start := case when policy_row.period = 'monthly' then date_trunc('month', now()) else date_trunc('day', now()) end;
  select coalesce(sum(amount), 0) into used_amount from public.usage_ledger where organization_id = p_organization_id and budget_key = p_budget_key and occurred_at >= period_start;
  projected := used_amount + p_amount;
  if policy_row.id is not null and projected > policy_row.hard_limit and policy_row.enforcement = 'block' then allowed := false; end if;
  if allowed then
    insert into public.usage_ledger (organization_id, budget_key, amount, unit, cost_amount, cost_currency, correlation_id, job_id, metadata)
    values (p_organization_id, p_budget_key, p_amount, p_unit, p_cost_amount, p_cost_currency, p_correlation_id, p_job_id, coalesce(p_metadata, '{}'::jsonb));
  end if;
  if policy_row.id is not null and projected > policy_row.soft_limit then
    alert_kind := case when projected > policy_row.hard_limit then 'budget_hard' else 'budget_soft' end;
    insert into public.operation_alerts (organization_id, dedupe_key, alert_type, severity, title, details)
    values (p_organization_id, 'budget:' || p_budget_key || ':' || to_char(period_start, 'YYYYMMDD'), alert_kind, case when projected > policy_row.hard_limit then 'critical' else 'warning' end, 'Usage budget threshold: ' || p_budget_key, jsonb_build_object('used', used_amount, 'requested', p_amount, 'projected', projected, 'soft_limit', policy_row.soft_limit, 'hard_limit', policy_row.hard_limit, 'unit', p_unit, 'allowed', allowed))
    on conflict (organization_id, dedupe_key) do update set status = 'open', alert_type = excluded.alert_type, severity = excluded.severity, details = excluded.details, occurrence_count = public.operation_alerts.occurrence_count + 1, last_occurred_at = now(), resolved_at = null;
  end if;
  return jsonb_build_object('configured', policy_row.id is not null, 'allowed', allowed, 'recorded', allowed, 'used_before', used_amount, 'projected', projected, 'soft_limit', policy_row.soft_limit, 'hard_limit', policy_row.hard_limit, 'unit', p_unit);
end
$$;

create or replace function public.record_provider_observation(p_organization_id uuid, p_provider_key text, p_operation_type text, p_outcome text, p_duration_ms int, p_correlation_id uuid, p_job_id uuid default null, p_error_code text default null, p_cost_amount numeric default null, p_cost_currency text default null, p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.provider_slo_policies;
  sample_count int;
  success_count int;
  error_count int;
  availability numeric;
  error_rate numeric;
  p95_latency numeric;
  breached boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  insert into public.provider_observations (organization_id, provider_key, operation_type, outcome, duration_ms, correlation_id, job_id, error_code, cost_amount, cost_currency, metadata)
  values (p_organization_id, p_provider_key, p_operation_type, p_outcome, p_duration_ms, p_correlation_id, p_job_id, p_error_code, p_cost_amount, p_cost_currency, coalesce(p_metadata, '{}'::jsonb));
  select * into policy_row from public.provider_slo_policies where organization_id = p_organization_id and provider_key = p_provider_key and operation_type = p_operation_type and enabled = true;
  if policy_row.id is null then return jsonb_build_object('configured', false, 'breached', false); end if;
  select count(*), count(*) filter (where outcome = 'success'), count(*) filter (where outcome in ('failure', 'timeout')), percentile_cont(0.95) within group (order by duration_ms)
  into sample_count, success_count, error_count, p95_latency
  from public.provider_observations
  where organization_id = p_organization_id and provider_key = p_provider_key and operation_type = p_operation_type and occurred_at >= now() - make_interval(mins => policy_row.window_minutes);
  availability := case when sample_count = 0 then 0 else success_count::numeric / sample_count * 100 end;
  error_rate := case when sample_count = 0 then 0 else error_count::numeric / sample_count * 100 end;
  if sample_count >= policy_row.minimum_samples then breached := availability < policy_row.target_availability_percent or error_rate > policy_row.max_error_rate_percent or p95_latency > policy_row.max_p95_latency_ms; end if;
  if breached then
    insert into public.operation_alerts (organization_id, dedupe_key, alert_type, severity, title, details)
    values (p_organization_id, 'slo:' || policy_row.id, 'slo_breach', 'critical', 'Provider SLO breach: ' || p_provider_key, jsonb_build_object('operation_type', p_operation_type, 'samples', sample_count, 'availability_percent', availability, 'error_rate_percent', error_rate, 'p95_latency_ms', p95_latency, 'targets', jsonb_build_object('availability_percent', policy_row.target_availability_percent, 'error_rate_percent', policy_row.max_error_rate_percent, 'p95_latency_ms', policy_row.max_p95_latency_ms)))
    on conflict (organization_id, dedupe_key) do update set status = 'open', details = excluded.details, occurrence_count = public.operation_alerts.occurrence_count + 1, last_occurred_at = now(), resolved_at = null;
  elsif sample_count >= policy_row.minimum_samples then
    update public.operation_alerts set status = 'resolved', resolved_at = now(), last_occurred_at = now() where organization_id = p_organization_id and dedupe_key = 'slo:' || policy_row.id and status <> 'resolved';
  end if;
  return jsonb_build_object('configured', true, 'breached', breached, 'samples', sample_count, 'availability_percent', availability, 'error_rate_percent', error_rate, 'p95_latency_ms', p95_latency);
end
$$;

create or replace function public.acknowledge_operation_alert(p_alert_id uuid)
returns public.operation_alerts
language plpgsql
security definer
set search_path = public
as $$
declare acknowledged public.operation_alerts;
begin
  select * into acknowledged from public.operation_alerts where id = p_alert_id for update;
  if acknowledged.id is null then raise exception 'Operation alert not found.'; end if;
  if not public.is_organization_member(acknowledged.organization_id, array['owner']) then raise exception 'Organization owner required.'; end if;
  update public.operation_alerts set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now() where id = p_alert_id returning * into acknowledged;
  return acknowledged;
end
$$;

create or replace function public.purge_expired_operational_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare observations_deleted int; usage_deleted int; counters_deleted int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  delete from public.provider_observations where retention_until <= now(); get diagnostics observations_deleted = row_count;
  delete from public.usage_ledger where retention_until <= now(); get diagnostics usage_deleted = row_count;
  delete from public.rate_limit_counters counter using public.rate_limit_policies policy where policy.organization_id = counter.organization_id and policy.limit_key = counter.limit_key and counter.window_started_at < now() - make_interval(secs => policy.window_seconds * 2); get diagnostics counters_deleted = row_count;
  return jsonb_build_object('provider_observations_deleted', observations_deleted, 'usage_rows_deleted', usage_deleted, 'rate_limit_counters_deleted', counters_deleted);
end
$$;

revoke all on function public.consume_rate_limit(uuid, text, text, int) from public, anon, authenticated;
revoke all on function public.consume_usage_budget(uuid, text, numeric, text, uuid, uuid, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_provider_observation(uuid, text, text, text, int, uuid, uuid, text, numeric, text, jsonb) from public, anon, authenticated;
revoke all on function public.purge_expired_operational_metrics() from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, text, int) to service_role;
grant execute on function public.consume_usage_budget(uuid, text, numeric, text, uuid, uuid, numeric, text, jsonb) to service_role;
grant execute on function public.record_provider_observation(uuid, text, text, text, int, uuid, uuid, text, numeric, text, jsonb) to service_role;
grant execute on function public.purge_expired_operational_metrics() to service_role;
revoke all on function public.acknowledge_operation_alert(uuid) from public, anon;
grant execute on function public.acknowledge_operation_alert(uuid) to authenticated, service_role;
