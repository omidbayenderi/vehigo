create table if not exists export_routes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  origin_country_code text not null check (origin_country_code ~ '^[A-Z]{2}$'),
  destination_country_code text not null check (destination_country_code ~ '^[A-Z]{2}$'),
  transit_country_codes text[] not null default '{}',
  transport_mode text not null check (transport_mode in ('road','rail','sea','air','multimodal')),
  default_currency text not null default 'EUR' check (default_currency ~ '^[A-Z]{3}$'),
  assumptions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists export_rule_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  version int not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','active','retired')),
  origin_country_code text check (origin_country_code is null or origin_country_code ~ '^[A-Z]{2}$'),
  destination_country_code text check (destination_country_code is null or destination_country_code ~ '^[A-Z]{2}$'),
  vehicle_category text,
  buyer_profile text,
  effective_from date,
  effective_to date,
  source_references jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  created_by uuid references users_profile(id) on delete set null,
  approved_by uuid references users_profile(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code, version),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  check (status <> 'active' or (approved_by is not null and approved_at is not null))
);

create table if not exists export_rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references export_rule_sets(id) on delete cascade,
  rule_code text not null,
  label text not null,
  category text not null check (category in ('tax','customs','logistics','insurance','service','compliance','other')),
  calculation_type text not null check (calculation_type in ('fixed','percentage')),
  base_key text check (base_key is null or base_key in ('vehicle_price','customs_value','subtotal')),
  amount numeric(16,4),
  rate_percent numeric(9,5),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  minimum_amount numeric(16,4),
  maximum_amount numeric(16,4),
  conditions jsonb not null default '{}'::jsonb,
  blocking boolean not null default false,
  evidence_required boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (rule_set_id, rule_code),
  check (
    (calculation_type = 'fixed' and amount is not null and currency is not null and rate_percent is null)
    or (calculation_type = 'percentage' and rate_percent is not null and base_key is not null and amount is null)
  ),
  check (rate_percent is null or rate_percent between 0 and 1000),
  check (minimum_amount is null or minimum_amount >= 0),
  check (maximum_amount is null or maximum_amount >= 0),
  check (minimum_amount is null or maximum_amount is null or minimum_amount <= maximum_amount)
);

create table if not exists exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  quote_currency text not null check (quote_currency ~ '^[A-Z]{3}$'),
  rate numeric(20,10) not null check (rate > 0),
  provider text not null,
  source_reference text,
  observed_at timestamptz not null,
  expires_at timestamptz,
  created_by uuid references users_profile(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (base_currency, quote_currency, provider, observed_at),
  check (base_currency <> quote_currency),
  check (expires_at is null or expires_at > observed_at)
);

create table if not exists export_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicle_id uuid references vehicles(id) on delete set null,
  market_listing_id uuid references market_listings(id) on delete set null,
  offer_id uuid references offers(id) on delete set null,
  route_id uuid references export_routes(id) on delete set null,
  rule_set_id uuid references export_rule_sets(id) on delete restrict,
  origin_country_code text not null check (origin_country_code ~ '^[A-Z]{2}$'),
  destination_country_code text not null check (destination_country_code ~ '^[A-Z]{2}$'),
  transport_mode text not null check (transport_mode in ('road','rail','sea','air','multimodal')),
  vehicle_category text not null,
  buyer_profile text not null,
  calculation_currency text not null default 'EUR' check (calculation_currency ~ '^[A-Z]{3}$'),
  vehicle_price numeric(16,2) not null check (vehicle_price >= 0),
  vehicle_currency text not null check (vehicle_currency ~ '^[A-Z]{3}$'),
  manual_costs jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','calculated','approved','archived')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','needs_review')),
  approval_reason text,
  approved_by uuid references users_profile(id) on delete set null,
  approved_at timestamptz,
  created_by uuid not null references users_profile(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_country_code <> destination_country_code),
  check ((approval_status = 'approved') = (approved_by is not null and approved_at is not null))
);

create table if not exists export_scenario_results (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references export_scenarios(id) on delete cascade,
  calculation_version text not null,
  evidence_hash text not null,
  input_snapshot jsonb not null,
  rule_snapshot jsonb not null,
  exchange_rate_snapshot jsonb not null,
  cost_lines jsonb not null,
  totals jsonb not null,
  sensitivity jsonb not null,
  compliance jsonb not null,
  calculated_by uuid references users_profile(id) on delete set null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (scenario_id, calculation_version, evidence_hash)
);

create table if not exists export_scenario_documents (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references export_scenarios(id) on delete cascade,
  document_code text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','received','verified','rejected','not_applicable')),
  notes text,
  reviewed_by uuid references users_profile(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scenario_id, document_code)
);

alter table offers add column if not exists export_scenario_result_id uuid references export_scenario_results(id) on delete set null;

create index if not exists export_rule_sets_lookup_idx on export_rule_sets (status, destination_country_code, origin_country_code, vehicle_category, effective_from desc);
create index if not exists export_rules_set_sort_idx on export_rules (rule_set_id, sort_order, rule_code);
create index if not exists exchange_rate_lookup_idx on exchange_rate_snapshots (base_currency, quote_currency, observed_at desc);
create index if not exists export_scenarios_user_updated_idx on export_scenarios (created_by, updated_at desc);
create index if not exists export_scenario_results_latest_idx on export_scenario_results (scenario_id, calculated_at desc);
create index if not exists export_scenario_documents_status_idx on export_scenario_documents (scenario_id, status);

drop trigger if exists export_routes_set_updated_at on export_routes;
create trigger export_routes_set_updated_at before update on export_routes for each row execute function set_updated_at();
drop trigger if exists export_rule_sets_set_updated_at on export_rule_sets;
create trigger export_rule_sets_set_updated_at before update on export_rule_sets for each row execute function set_updated_at();
drop trigger if exists export_scenarios_set_updated_at on export_scenarios;
create trigger export_scenarios_set_updated_at before update on export_scenarios for each row execute function set_updated_at();
drop trigger if exists export_scenario_documents_set_updated_at on export_scenario_documents;
create trigger export_scenario_documents_set_updated_at before update on export_scenario_documents for each row execute function set_updated_at();

alter table export_routes enable row level security;
alter table export_rule_sets enable row level security;
alter table export_rules enable row level security;
alter table exchange_rate_snapshots enable row level security;
alter table export_scenarios enable row level security;
alter table export_scenario_results enable row level security;
alter table export_scenario_documents enable row level security;

drop policy if exists "export routes readable by authenticated" on export_routes;
drop policy if exists "export routes manageable by owner" on export_routes;
drop policy if exists "export rule sets readable by authenticated" on export_rule_sets;
drop policy if exists "export rule sets manageable by owner" on export_rule_sets;
drop policy if exists "export rules readable by authenticated" on export_rules;
drop policy if exists "export rules manageable by owner" on export_rules;
drop policy if exists "exchange rates readable by authenticated" on exchange_rate_snapshots;
drop policy if exists "exchange rates manageable by owner" on exchange_rate_snapshots;
drop policy if exists "export scenarios readable by authenticated" on export_scenarios;
drop policy if exists "export scenarios insertable by creator" on export_scenarios;
drop policy if exists "export scenarios updatable by owner or creator" on export_scenarios;
drop policy if exists "export scenarios deletable by owner or creator" on export_scenarios;
drop policy if exists "export results readable by authenticated" on export_scenario_results;
drop policy if exists "export results insertable by scenario owner" on export_scenario_results;
drop policy if exists "export documents readable by authenticated" on export_scenario_documents;
drop policy if exists "export documents writable by scenario owner" on export_scenario_documents;

create policy "export routes readable by authenticated" on export_routes for select using (auth.role() = 'authenticated');
create policy "export routes manageable by owner" on export_routes for all using (exists (select 1 from users_profile where id = auth.uid() and role = 'owner')) with check (exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
create policy "export rule sets readable by authenticated" on export_rule_sets for select using (auth.role() = 'authenticated');
create policy "export rule sets manageable by owner" on export_rule_sets for all using (exists (select 1 from users_profile where id = auth.uid() and role = 'owner')) with check (exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
create policy "export rules readable by authenticated" on export_rules for select using (auth.role() = 'authenticated');
create policy "export rules manageable by owner" on export_rules for all using (exists (select 1 from users_profile where id = auth.uid() and role = 'owner')) with check (exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
create policy "exchange rates readable by authenticated" on exchange_rate_snapshots for select using (auth.role() = 'authenticated');
create policy "exchange rates manageable by owner" on exchange_rate_snapshots for all using (exists (select 1 from users_profile where id = auth.uid() and role = 'owner')) with check (exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
create policy "export scenarios readable by authenticated" on export_scenarios for select using (auth.role() = 'authenticated');
create policy "export scenarios insertable by creator" on export_scenarios for insert with check (auth.uid() = created_by);
create policy "export scenarios updatable by owner or creator" on export_scenarios for update using (auth.uid() = created_by or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')) with check (auth.uid() = created_by or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
create policy "export scenarios deletable by owner or creator" on export_scenarios for delete using (auth.uid() = created_by or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'));
create policy "export results readable by authenticated" on export_scenario_results for select using (auth.role() = 'authenticated');
create policy "export results insertable by scenario owner" on export_scenario_results for insert with check (exists (select 1 from export_scenarios where id = scenario_id and (created_by = auth.uid() or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'))));
create policy "export documents readable by authenticated" on export_scenario_documents for select using (auth.role() = 'authenticated');
create policy "export documents writable by scenario owner" on export_scenario_documents for all using (exists (select 1 from export_scenarios where id = scenario_id and (created_by = auth.uid() or exists (select 1 from users_profile where id = auth.uid() and role = 'owner')))) with check (exists (select 1 from export_scenarios where id = scenario_id and (created_by = auth.uid() or exists (select 1 from users_profile where id = auth.uid() and role = 'owner'))));
