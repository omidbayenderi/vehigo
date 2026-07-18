-- Cross-run duplicate suppression for transient search results. This table
-- deliberately stores no listing title, URL, price, description, provider
-- payload, or reversible source identifier. The receipt hash must be produced
-- with a server-side HMAC secret that is never stored in Postgres.
create table public.transient_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users_profile(id) on delete cascade,
  source_key text not null references public.market_sources(key) on delete cascade,
  receipt_hash text not null,
  status text not null default 'pending',
  claimed_at timestamptz not null default now(),
  notified_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transient_delivery_receipts_hash_check
    check (receipt_hash ~ '^[0-9a-f]{64}$'),
  constraint transient_delivery_receipts_status_check
    check (status in ('pending', 'sent')),
  constraint transient_delivery_receipts_expiry_check
    check (expires_at > claimed_at),
  constraint transient_delivery_receipts_unique
    unique (organization_id, user_id, source_key, receipt_hash)
);

create index transient_delivery_receipts_expires_idx
  on public.transient_delivery_receipts (expires_at);

create index transient_delivery_receipts_user_idx
  on public.transient_delivery_receipts (user_id);

create index transient_delivery_receipts_source_idx
  on public.transient_delivery_receipts (source_key);

create index transient_delivery_receipts_pending_claim_idx
  on public.transient_delivery_receipts (claimed_at)
  where status = 'pending';

alter table public.transient_delivery_receipts enable row level security;
alter table public.transient_delivery_receipts force row level security;

-- Receipts are an internal delivery primitive. Browser clients must not read
-- or mutate them; only the server-side scanner service role may do so.
revoke all on table public.transient_delivery_receipts from public, anon, authenticated;
grant select, insert, update, delete on table public.transient_delivery_receipts to service_role;
