-- Connector operations and durable ingest lifecycle.

alter table market_sources
  add column if not exists catalog_status text not null default 'planned',
  add column if not exists contract_status text not null default 'unknown',
  add column if not exists contract_error text,
  add column if not exists last_contract_check_at timestamptz,
  add column if not exists data_retention_days int not null default 30,
  add column if not exists terms_url text,
  add column if not exists robots_url text;

alter table market_sources
  drop constraint if exists market_sources_catalog_status_check,
  add constraint market_sources_catalog_status_check
    check (catalog_status in ('planned', 'available', 'degraded', 'blocked', 'retired')) not valid,
  drop constraint if exists market_sources_contract_status_check,
  add constraint market_sources_contract_status_check
    check (contract_status in ('unknown', 'ok', 'failed')) not valid,
  drop constraint if exists market_sources_data_retention_days_check,
  add constraint market_sources_data_retention_days_check
    check (data_retention_days between 1 and 365) not valid;

update market_sources
set catalog_status = case when enabled then 'available' else 'planned' end;

create table scanner_ingest_events (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately not a foreign key: rejected payloads may reference unknown sources.
  source_key text not null,
  channel text not null check (channel in ('connector', 'email_alert', 'authorized_automation', 'replay')),
  idempotency_key text not null,
  payload_hash text not null,
  payload jsonb,
  status text not null check (status in ('received', 'processing', 'completed', 'rejected', 'failed')) default 'received',
  listing_count int not null default 0 check (listing_count >= 0),
  result jsonb,
  attempt_count int not null default 0 check (attempt_count >= 0),
  error_code text,
  error_message text,
  next_retry_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  payload_expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, idempotency_key)
);

drop trigger if exists scanner_ingest_events_set_updated_at on scanner_ingest_events;
create trigger scanner_ingest_events_set_updated_at before update on scanner_ingest_events
  for each row execute function set_updated_at();

create index if not exists scanner_ingest_events_replay_idx
  on scanner_ingest_events (status, next_retry_at, created_at)
  where status = 'failed';
create index if not exists scanner_ingest_events_source_created_idx
  on scanner_ingest_events (source_key, created_at desc);
create index if not exists scanner_ingest_events_payload_expiry_idx
  on scanner_ingest_events (payload_expires_at)
  where payload is not null;

alter table scanner_ingest_events enable row level security;

create policy "scanner ingest events readable by owner" on scanner_ingest_events
  for select using (
    exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );

create or replace function purge_expired_scanner_ingest_payloads()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  purged int;
begin
  update scanner_ingest_events
  set payload = null
  where payload is not null and payload_expires_at <= now();
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function purge_expired_scanner_ingest_payloads() from public, anon, authenticated;
grant execute on function purge_expired_scanner_ingest_payloads() to service_role;
