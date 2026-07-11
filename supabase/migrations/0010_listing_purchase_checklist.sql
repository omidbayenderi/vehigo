-- Pre-purchase risk checklist + acquisition cost estimate for a shortlisted market
-- listing. Distinct from compliance_checklist (which is export/sanctions compliance
-- for an offer already sent to a customer) — this is "should I even buy this vehicle"
-- risk review: VIN, condition, seller trust, payment risk.

create table listing_purchase_checklist (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_listings(id) on delete cascade unique,
  vin text,
  vin_verified boolean not null default false,
  documents_checked boolean not null default false,
  damage_inspected boolean not null default false,
  damage_notes text,
  seller_trustworthy boolean not null default false,
  seller_notes text,
  payment_risk_acceptable boolean not null default false,
  payment_notes text,
  estimated_transport_cost numeric(12,2) not null default 0,
  estimated_insurance_cost numeric(12,2) not null default 0,
  estimated_customs_cost numeric(12,2) not null default 0,
  estimated_prep_cost numeric(12,2) not null default 0,
  all_clear boolean generated always as (
    vin_verified and documents_checked and damage_inspected and
    seller_trustworthy and payment_risk_acceptable
  ) stored,
  reviewed_by uuid references users_profile(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger listing_purchase_checklist_set_updated_at before update on listing_purchase_checklist
  for each row execute function set_updated_at();

alter table listing_purchase_checklist enable row level security;

create policy "purchase checklist readable by authenticated" on listing_purchase_checklist
  for select using (auth.role() = 'authenticated');

create policy "purchase checklist writable by owner/broker" on listing_purchase_checklist
  for all using (
    exists (select 1 from users_profile where id = auth.uid() and role in ('owner', 'broker'))
  ) with check (
    exists (select 1 from users_profile where id = auth.uid() and role in ('owner', 'broker'))
  );
