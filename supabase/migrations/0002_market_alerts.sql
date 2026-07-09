-- ========== MARKET WATCH / ALERTS ==========
alter table users_profile
  add column if not exists telegram_username text,
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_verified_at timestamptz;

create unique index if not exists users_profile_telegram_username_unique
  on users_profile (lower(telegram_username))
  where telegram_username is not null;

create table market_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  base_url text,
  enabled boolean default true,
  min_interval_minutes int not null default 15 check (min_interval_minutes >= 1),
  jitter_percent int not null default 35 check (jitter_percent between 0 and 100),
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text check (last_status in ('idle','ok','failed','blocked','skipped')) default 'idle',
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users_profile(id) on delete cascade,
  name text not null,
  active boolean default true,
  source_keys text[] default '{}',
  country text,
  city text,
  brand text,
  model text,
  vehicle_type text check (vehicle_type in ('truck','trailer','construction','spare_part','bus','other')),
  min_year int,
  max_year int,
  max_mileage_km int,
  min_price numeric(12,2),
  max_price numeric(12,2),
  currency text default 'EUR',
  keywords text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table market_listings (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_listing_id text not null,
  listing_url text not null,
  title text,
  seller_name text,
  seller_country text,
  seller_city text,
  brand text,
  model text,
  year int,
  mileage_km int,
  price numeric(12,2),
  currency text default 'EUR',
  vehicle_type text check (vehicle_type in ('truck','trailer','construction','spare_part','bus','other')),
  raw jsonb,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (source_key, source_listing_id),
  unique (source_key, listing_url)
);

create table listing_alerts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_listings(id) on delete cascade,
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  user_id uuid not null references users_profile(id) on delete cascade,
  status text check (status in ('pending','sent','failed','skipped')) default 'pending',
  channel text check (channel in ('telegram')) default 'telegram',
  error text,
  sent_at timestamptz,
  created_at timestamptz default now(),
  unique (listing_id, watchlist_id, user_id)
);

create table scanner_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text check (status in ('ok','failed','blocked','skipped')) not null,
  fetched_count int default 0,
  new_count int default 0,
  alert_count int default 0,
  next_run_at timestamptz,
  error text
);

create trigger market_sources_set_updated_at before update on market_sources
  for each row execute function set_updated_at();
create trigger watchlists_set_updated_at before update on watchlists
  for each row execute function set_updated_at();
create trigger market_listings_set_updated_at before update on market_listings
  for each row execute function set_updated_at();

alter table market_sources enable row level security;
alter table watchlists enable row level security;
alter table market_listings enable row level security;
alter table listing_alerts enable row level security;
alter table scanner_runs enable row level security;

create policy "market_sources readable by authenticated" on market_sources
  for select using (auth.role() = 'authenticated');

create policy "watchlists readable by owner" on watchlists
  for select using (auth.uid() = user_id);
create policy "watchlists insertable by owner" on watchlists
  for insert with check (auth.uid() = user_id);
create policy "watchlists updatable by owner" on watchlists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlists deletable by owner" on watchlists
  for delete using (auth.uid() = user_id);

create policy "market_listings readable by authenticated" on market_listings
  for select using (auth.role() = 'authenticated');

create policy "listing_alerts readable by owner" on listing_alerts
  for select using (auth.uid() = user_id);
create policy "listing_alerts updatable by owner" on listing_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "scanner_runs readable by owner role" on scanner_runs
  for select using (
    exists (select 1 from users_profile where id = auth.uid() and role = 'owner')
  );

insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent)
values
  ('mobile_de', 'mobile.de', 'https://www.mobile.de', 15, 35),
  ('truckscout24', 'TruckScout24', 'https://www.truckscout24.com', 20, 40),
  ('autoline', 'Autoline', 'https://autoline.info', 20, 40),
  ('autoscout24', 'AutoScout24', 'https://www.autoscout24.com', 20, 40)
on conflict (key) do nothing;
