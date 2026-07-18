-- Commercial buying profiles and reproducible opportunity economics.
-- All fields are additive and use conservative defaults. Existing watchlists
-- keep their current matching behaviour until an operator supplies economics.

alter table public.watchlists
  add column if not exists destination_country_code text,
  add column if not exists estimated_fixed_costs numeric(12,2) not null default 0,
  add column if not exists monthly_holding_cost numeric(12,2) not null default 0,
  add column if not exists cost_reserve_percent numeric(5,2) not null default 10,
  add column if not exists conservative_sale_discount_percent numeric(5,2) not null default 5,
  add column if not exists min_net_profit numeric(12,2) not null default 3000,
  add column if not exists min_net_margin_percent numeric(5,2) not null default 12,
  add column if not exists max_inventory_days int not null default 45,
  add column if not exists instant_alert_score int not null default 85;

alter table public.watchlists
  drop constraint if exists watchlists_destination_country_code_check,
  add constraint watchlists_destination_country_code_check
    check (destination_country_code is null or destination_country_code ~ '^[A-Z]{2}$') not valid,
  drop constraint if exists watchlists_commercial_costs_check,
  add constraint watchlists_commercial_costs_check check (
    estimated_fixed_costs >= 0
    and monthly_holding_cost >= 0
    and cost_reserve_percent between 0 and 100
    and conservative_sale_discount_percent between 0 and 50
    and min_net_profit >= 0
    and min_net_margin_percent between 0 and 100
    and max_inventory_days between 1 and 730
    and instant_alert_score between 50 and 100
  ) not valid;

alter table public.listing_alerts
  add column if not exists commercial_status text not null default 'not_evaluated',
  add column if not exists commercial_evaluation_version text,
  add column if not exists estimated_purchase_cost numeric(12,2),
  add column if not exists expected_sale_price numeric(12,2),
  add column if not exists estimated_total_cost numeric(12,2),
  add column if not exists estimated_net_profit numeric(12,2),
  add column if not exists estimated_net_margin_percent numeric(7,2),
  add column if not exists commercial_confidence numeric(5,4),
  add column if not exists commercial_comparable_count int,
  add column if not exists commercial_evidence jsonb,
  add column if not exists commercially_evaluated_at timestamptz,
  add column if not exists instant_notified_at timestamptz;

alter table public.listing_alerts
  drop constraint if exists listing_alerts_commercial_status_check,
  add constraint listing_alerts_commercial_status_check
    check (commercial_status in ('not_evaluated','approved','rejected','insufficient_data','error')) not valid,
  drop constraint if exists listing_alerts_commercial_values_check,
  add constraint listing_alerts_commercial_values_check check (
    (estimated_purchase_cost is null or estimated_purchase_cost >= 0)
    and (expected_sale_price is null or expected_sale_price >= 0)
    and (estimated_total_cost is null or estimated_total_cost >= 0)
    and (commercial_confidence is null or commercial_confidence between 0 and 1)
    and (commercial_comparable_count is null or commercial_comparable_count >= 0)
  ) not valid;

create index if not exists listing_alerts_commercial_queue_idx
  on public.listing_alerts (organization_id, commercial_status, opportunity_score desc, created_at)
  where status = 'pending';

-- Runtime providers may only persist data when their connector policy permits
-- it. The actual evidence remains in provider_storage_rights_evidence.
alter table public.market_sources
  add column if not exists persistence_policy text not null default 'evidence_required';

alter table public.market_sources
  drop constraint if exists market_sources_persistence_policy_check,
  add constraint market_sources_persistence_policy_check
    check (persistence_policy in ('transient_only','evidence_required','permitted')) not valid;

update public.market_sources
set persistence_policy = 'evidence_required'
where key in ('brave_web','apify_mobile_de','apify_autoscout24','apify_marktplaats');

-- Known source-term conflict: keep the Actor catalogued but fail closed until
-- a written partnership/authorization is recorded and an operator re-enables it.
update public.market_sources
set enabled = false,
    contract_status = 'failed',
    catalog_status = 'blocked',
    contract_error = 'Written Marktplaats API/reuse authorization is required before activation.'
where key = 'apify_marktplaats';
