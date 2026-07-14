create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  default_currency text not null default 'EUR' check (default_currency ~ '^[A-Z]{3}$'),
  default_retention_days int not null default 30 check (default_retention_days between 1 and 3650),
  created_by uuid references public.users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users_profile(id) on delete cascade,
  role text not null check (role in ('owner', 'broker', 'assistant')),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  invited_by uuid references public.users_profile(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

insert into public.organizations (slug, name, created_by)
select 'vehigo-default', 'Vehigo', profile.id
from public.users_profile profile
order by case when profile.role = 'owner' then 0 else 1 end, profile.created_at, profile.id
limit 1
on conflict (slug) do nothing;

insert into public.organization_members (organization_id, user_id, role, status, invited_by, joined_at)
select organization.id, profile.id, profile.role, 'active', organization.created_by, profile.created_at
from public.organizations organization
cross join public.users_profile profile
where organization.slug = 'vehigo-default'
on conflict (organization_id, user_id) do update
set role = excluded.role,
    status = 'active',
    joined_at = coalesce(public.organization_members.joined_at, excluded.joined_at);

create or replace function public.is_organization_member(p_organization_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    join public.organizations organization on organization.id = member.organization_id
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and organization.status = 'active'
      and (p_roles is null or member.role = any(p_roles))
  );
$$;

revoke all on function public.is_organization_member(uuid, text[]) from public;
grant execute on function public.is_organization_member(uuid, text[]) to authenticated, service_role;

alter table public.audit_log add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
alter table public.scanner_ingest_events add column if not exists organization_id uuid references public.organizations(id) on delete restrict;

update public.audit_log
set organization_id = (select id from public.organizations where slug = 'vehigo-default')
where organization_id is null;

update public.scanner_ingest_events
set organization_id = (select id from public.organizations where slug = 'vehigo-default')
where organization_id is null;

create table if not exists public.operation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  queue text not null check (queue ~ '^[a-z][a-z0-9._-]{0,79}$'),
  job_type text not null check (job_type ~ '^[a-z][a-z0-9._-]{0,119}$'),
  job_version int not null default 1 check (job_version between 1 and 100000),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9._:-]{1,160}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'leased', 'running', 'retry_wait', 'succeeded', 'failed', 'dead_letter', 'cancelled')),
  priority smallint not null default 50 check (priority between 0 and 100),
  attempt_count int not null default 0 check (attempt_count >= 0),
  max_attempts int not null default 5 check (max_attempts between 1 and 1000),
  retry_base_seconds int not null default 30 check (retry_base_seconds between 1 and 86400),
  retry_cap_seconds int not null default 21600 check (retry_cap_seconds between 1 and 604800),
  replay_count int not null default 0 check (replay_count >= 0),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  correlation_id uuid not null default gen_random_uuid(),
  parent_job_id uuid references public.operation_jobs(id) on delete set null,
  result jsonb,
  error_code text,
  error_message text,
  created_by uuid references public.users_profile(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  retention_until timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, queue, idempotency_key),
  check ((lease_token is null) = (lease_expires_at is null)),
  check (retry_cap_seconds >= retry_base_seconds)
);

create table if not exists public.operation_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  job_id uuid not null references public.operation_jobs(id) on delete cascade,
  attempt_number int not null check (attempt_number > 0),
  worker_id text not null,
  lease_token uuid not null,
  status text not null check (status in ('leased', 'running', 'succeeded', 'failed', 'lease_expired')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int check (duration_ms is null or duration_ms >= 0),
  error_code text,
  error_message text,
  metrics jsonb not null default '{}'::jsonb,
  unique (job_id, attempt_number),
  unique (lease_token)
);

create table if not exists public.operation_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  job_id uuid references public.operation_jobs(id) on delete cascade,
  correlation_id uuid not null,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  event_type text not null check (char_length(event_type) between 1 and 120),
  message text not null check (char_length(message) between 1 and 2000),
  attributes jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '30 days')
);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at before update on public.organization_members for each row execute function public.set_updated_at();
drop trigger if exists operation_jobs_set_updated_at on public.operation_jobs;
create trigger operation_jobs_set_updated_at before update on public.operation_jobs for each row execute function public.set_updated_at();

create index if not exists organization_members_user_idx on public.organization_members (user_id, status, organization_id);
create index if not exists operation_jobs_claim_idx on public.operation_jobs (queue, priority desc, available_at, created_at) where status in ('queued', 'retry_wait');
create index if not exists operation_jobs_lease_expiry_idx on public.operation_jobs (lease_expires_at) where status in ('leased', 'running');
create index if not exists operation_jobs_dead_letter_idx on public.operation_jobs (organization_id, queue, completed_at desc) where status = 'dead_letter';
create index if not exists operation_jobs_retention_idx on public.operation_jobs (retention_until) where status in ('succeeded', 'failed', 'dead_letter', 'cancelled');
create index if not exists operation_attempts_job_idx on public.operation_attempts (job_id, attempt_number desc);
create index if not exists operation_events_correlation_idx on public.operation_events (organization_id, correlation_id, occurred_at);
create index if not exists operation_events_retention_idx on public.operation_events (retention_until);
create unique index if not exists scanner_ingest_events_org_idempotency_idx on public.scanner_ingest_events (organization_id, source_key, idempotency_key) where organization_id is not null;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.operation_jobs enable row level security;
alter table public.operation_attempts enable row level security;
alter table public.operation_events enable row level security;

drop policy if exists "organizations readable by active members" on public.organizations;
create policy "organizations readable by active members" on public.organizations for select using (public.is_organization_member(id));
drop policy if exists "organizations manageable by owners" on public.organizations;
create policy "organizations manageable by owners" on public.organizations for update using (public.is_organization_member(id, array['owner'])) with check (public.is_organization_member(id, array['owner']));

drop policy if exists "memberships readable by organization members" on public.organization_members;
create policy "memberships readable by organization members" on public.organization_members for select using (public.is_organization_member(organization_id));
drop policy if exists "memberships manageable by organization owners" on public.organization_members;
create policy "memberships manageable by organization owners" on public.organization_members for all using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']));

drop policy if exists "operation jobs readable by members" on public.operation_jobs;
create policy "operation jobs readable by members" on public.operation_jobs for select using (public.is_organization_member(organization_id));
drop policy if exists "operation jobs insertable by members" on public.operation_jobs;
create policy "operation jobs insertable by members" on public.operation_jobs for insert with check (public.is_organization_member(organization_id) and created_by = auth.uid());
drop policy if exists "operation jobs manageable by owners" on public.operation_jobs;
create policy "operation jobs manageable by owners" on public.operation_jobs for update using (public.is_organization_member(organization_id, array['owner'])) with check (public.is_organization_member(organization_id, array['owner']));
drop policy if exists "operation attempts readable by members" on public.operation_attempts;
create policy "operation attempts readable by members" on public.operation_attempts for select using (public.is_organization_member(organization_id));
drop policy if exists "operation events readable by members" on public.operation_events;
create policy "operation events readable by members" on public.operation_events for select using (public.is_organization_member(organization_id));

drop policy if exists "audit_log readable by authenticated" on public.audit_log;
drop policy if exists "audit_log insertable by authenticated" on public.audit_log;
drop policy if exists "audit log readable by organization members" on public.audit_log;
create policy "audit log readable by organization members" on public.audit_log for select using (organization_id is not null and public.is_organization_member(organization_id));
drop policy if exists "audit log insertable by organization members" on public.audit_log;
create policy "audit log insertable by organization members" on public.audit_log for insert with check (actor_id = auth.uid() and organization_id is not null and public.is_organization_member(organization_id));

create or replace function public.recover_expired_operation_leases()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_job public.operation_jobs;
  recovered_job public.operation_jobs;
  next_status text;
  recovered_count int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  for expired_job in
    select * from public.operation_jobs
    where status in ('leased', 'running') and lease_expires_at <= now()
    order by lease_expires_at
    for update skip locked
    limit 500
  loop
    next_status := case when expired_job.attempt_count < expired_job.max_attempts then 'retry_wait' else 'dead_letter' end;
    update public.operation_attempts
    set status = 'lease_expired', finished_at = now(), duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)::int), error_code = 'lease_expired', error_message = 'Worker lease expired before completion.'
    where job_id = expired_job.id and lease_token = expired_job.lease_token and status in ('leased', 'running');
    update public.operation_jobs
    set status = next_status,
        available_at = case when next_status = 'retry_wait' then now() else available_at end,
        completed_at = case when next_status = 'dead_letter' then now() else null end,
        error_code = 'lease_expired',
        error_message = 'Worker lease expired before completion.',
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null
    where id = expired_job.id
    returning * into recovered_job;
    insert into public.operation_events (organization_id, job_id, correlation_id, level, event_type, message, attributes, retention_until)
    values (recovered_job.organization_id, recovered_job.id, recovered_job.correlation_id, case when next_status = 'dead_letter' then 'error' else 'warn' end, case when next_status = 'dead_letter' then 'job.dead_lettered' else 'job.lease_recovered' end, recovered_job.error_message, jsonb_build_object('attempt', recovered_job.attempt_count), recovered_job.retention_until);
    recovered_count := recovered_count + 1;
  end loop;
  return recovered_count;
end
$$;

create or replace function public.claim_operation_jobs(p_worker_id text, p_queues text[], p_limit int default 10, p_lease_seconds int default 120)
returns setof public.operation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.operation_jobs;
  claimed public.operation_jobs;
  token uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if nullif(btrim(p_worker_id), '') is null or coalesce(array_length(p_queues, 1), 0) = 0 then
    raise exception 'Worker id and at least one queue are required.';
  end if;

  perform public.recover_expired_operation_leases();

  for candidate in
    select *
    from public.operation_jobs job
    where job.queue = any(p_queues)
      and job.status in ('queued', 'retry_wait')
      and job.available_at <= now()
      and job.attempt_count < job.max_attempts
    order by job.priority desc, job.available_at, job.created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  loop
    token := gen_random_uuid();
    update public.operation_jobs
    set status = 'leased',
        attempt_count = attempt_count + 1,
        lease_owner = left(p_worker_id, 160),
        lease_token = token,
        lease_expires_at = now() + make_interval(secs => greatest(15, least(p_lease_seconds, 3600))),
        started_at = coalesce(started_at, now()),
        error_code = null,
        error_message = null
    where id = candidate.id
    returning * into claimed;

    insert into public.operation_attempts (organization_id, job_id, attempt_number, worker_id, lease_token, status)
    values (claimed.organization_id, claimed.id, claimed.attempt_count, left(p_worker_id, 160), token, 'leased');

    insert into public.operation_events (organization_id, job_id, correlation_id, level, event_type, message, attributes, retention_until)
    values (claimed.organization_id, claimed.id, claimed.correlation_id, 'info', 'job.leased', 'Operation job leased.', jsonb_build_object('worker_id', left(p_worker_id, 160), 'attempt', claimed.attempt_count), claimed.retention_until);

    return next claimed;
  end loop;
end
$$;

create or replace function public.heartbeat_operation_job(p_job_id uuid, p_lease_token uuid, p_extend_seconds int default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  update public.operation_jobs
  set status = 'running', lease_expires_at = now() + make_interval(secs => greatest(15, least(p_extend_seconds, 3600)))
  where id = p_job_id and lease_token = p_lease_token and status in ('leased', 'running') and lease_expires_at > now();
  if not found then return false; end if;
  update public.operation_attempts set status = 'running' where job_id = p_job_id and lease_token = p_lease_token;
  return true;
end
$$;

create or replace function public.complete_operation_job(p_job_id uuid, p_lease_token uuid, p_result jsonb default '{}'::jsonb, p_metrics jsonb default '{}'::jsonb)
returns public.operation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  completed public.operation_jobs;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  update public.operation_jobs
  set status = 'succeeded', result = coalesce(p_result, '{}'::jsonb), completed_at = now(), lease_owner = null, lease_token = null, lease_expires_at = null
  where id = p_job_id and lease_token = p_lease_token and status in ('leased', 'running') and lease_expires_at > now()
  returning * into completed;
  if completed.id is null then raise exception 'Active lease not found.'; end if;
  update public.operation_attempts
  set status = 'succeeded', finished_at = now(), duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)::int), metrics = coalesce(p_metrics, '{}'::jsonb)
  where job_id = p_job_id and lease_token = p_lease_token;
  insert into public.operation_events (organization_id, job_id, correlation_id, level, event_type, message, attributes, retention_until)
  values (completed.organization_id, completed.id, completed.correlation_id, 'info', 'job.succeeded', 'Operation job succeeded.', coalesce(p_metrics, '{}'::jsonb), completed.retention_until);
  return completed;
end
$$;

create or replace function public.fail_operation_job(p_job_id uuid, p_lease_token uuid, p_error_code text, p_error_message text, p_retryable boolean default true, p_metrics jsonb default '{}'::jsonb)
returns public.operation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.operation_jobs;
  failed_job public.operation_jobs;
  next_status text;
  delay_seconds int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  select * into current_job from public.operation_jobs
  where id = p_job_id and lease_token = p_lease_token and status in ('leased', 'running') and lease_expires_at > now()
  for update;
  if current_job.id is null then raise exception 'Active lease not found.'; end if;

  next_status := case when p_retryable and current_job.attempt_count < current_job.max_attempts then 'retry_wait' else 'dead_letter' end;
  delay_seconds := least(current_job.retry_cap_seconds, current_job.retry_base_seconds * (2 ^ greatest(0, current_job.attempt_count - 1))::int);

  update public.operation_jobs
  set status = next_status,
      error_code = left(coalesce(nullif(btrim(p_error_code), ''), 'operation_failed'), 120),
      error_message = left(regexp_replace(coalesce(p_error_message, 'Operation failed.'), E'[\\r\\n\\t]+', ' ', 'g'), 2000),
      available_at = case when next_status = 'retry_wait' then now() + make_interval(secs => delay_seconds) else available_at end,
      completed_at = case when next_status = 'dead_letter' then now() else null end,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null
  where id = current_job.id
  returning * into failed_job;

  update public.operation_attempts
  set status = 'failed', finished_at = now(), duration_ms = greatest(0, floor(extract(epoch from (now() - started_at)) * 1000)::int), error_code = failed_job.error_code, error_message = failed_job.error_message, metrics = coalesce(p_metrics, '{}'::jsonb)
  where job_id = p_job_id and lease_token = p_lease_token;
  insert into public.operation_events (organization_id, job_id, correlation_id, level, event_type, message, attributes, retention_until)
  values (failed_job.organization_id, failed_job.id, failed_job.correlation_id, case when next_status = 'dead_letter' then 'error' else 'warn' end, case when next_status = 'dead_letter' then 'job.dead_lettered' else 'job.retry_scheduled' end, failed_job.error_message, jsonb_build_object('error_code', failed_job.error_code, 'attempt', failed_job.attempt_count, 'retryable', p_retryable), failed_job.retention_until);
  return failed_job;
end
$$;

create or replace function public.replay_dead_letter_operation(p_job_id uuid)
returns public.operation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  replayed public.operation_jobs;
begin
  select * into replayed from public.operation_jobs where id = p_job_id for update;
  if replayed.id is null then raise exception 'Operation job not found.'; end if;
  if not public.is_organization_member(replayed.organization_id, array['owner']) then raise exception 'Organization owner required.'; end if;
  if replayed.status <> 'dead_letter' then raise exception 'Only dead-letter jobs can be replayed.'; end if;
  update public.operation_jobs
  set status = 'queued', max_attempts = max_attempts + 5, replay_count = replay_count + 1, available_at = now(), completed_at = null, error_code = null, error_message = null
  where id = p_job_id returning * into replayed;
  insert into public.audit_log (organization_id, actor_id, action, entity_type, entity_id, metadata)
  values (replayed.organization_id, auth.uid(), 'operation_replayed', 'operation_job', replayed.id, jsonb_build_object('replay_count', replayed.replay_count));
  return replayed;
end
$$;

create or replace function public.purge_expired_operation_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_events int;
  scrubbed_jobs int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required.'; end if;
  delete from public.operation_events where retention_until <= now();
  get diagnostics deleted_events = row_count;
  update public.operation_jobs set payload = '{}'::jsonb, result = null
  where retention_until <= now() and status in ('succeeded', 'failed', 'dead_letter', 'cancelled') and (payload <> '{}'::jsonb or result is not null);
  get diagnostics scrubbed_jobs = row_count;
  return jsonb_build_object('deleted_events', deleted_events, 'scrubbed_jobs', scrubbed_jobs);
end
$$;

revoke all on function public.claim_operation_jobs(text, text[], int, int) from public, anon, authenticated;
revoke all on function public.recover_expired_operation_leases() from public, anon, authenticated;
revoke all on function public.heartbeat_operation_job(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.complete_operation_job(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.fail_operation_job(uuid, uuid, text, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.purge_expired_operation_data() from public, anon, authenticated;
grant execute on function public.claim_operation_jobs(text, text[], int, int) to service_role;
grant execute on function public.recover_expired_operation_leases() to service_role;
grant execute on function public.heartbeat_operation_job(uuid, uuid, int) to service_role;
grant execute on function public.complete_operation_job(uuid, uuid, jsonb, jsonb) to service_role;
grant execute on function public.fail_operation_job(uuid, uuid, text, text, boolean, jsonb) to service_role;
grant execute on function public.purge_expired_operation_data() to service_role;
revoke all on function public.replay_dead_letter_operation(uuid) from public, anon;
grant execute on function public.replay_dead_letter_operation(uuid) to authenticated, service_role;
