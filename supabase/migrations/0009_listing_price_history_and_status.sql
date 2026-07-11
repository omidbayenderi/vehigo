-- Track price changes over time and detect listings that stopped appearing in scans
-- (treated as sold/removed), plus a distinct alert type so price drops can be
-- Telegram-notified separately from first-time watchlist matches.

alter table market_listings
  add column if not exists status text not null default 'active'
    check (status in ('active', 'delisted')),
  add column if not exists delisted_at timestamptz;

create table if not exists market_listing_price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_listings(id) on delete cascade,
  price numeric(12,2),
  currency text,
  recorded_at timestamptz not null default now()
);

create index if not exists market_listing_price_history_listing_id_idx
  on market_listing_price_history (listing_id, recorded_at desc);

alter table market_listing_price_history enable row level security;

create policy "price history readable by authenticated" on market_listing_price_history
  for select using (auth.role() = 'authenticated');

alter table listing_alerts
  add column if not exists alert_type text not null default 'new_match'
    check (alert_type in ('new_match', 'price_drop'));

alter table listing_alerts
  drop constraint if exists listing_alerts_listing_id_watchlist_id_user_id_key;

alter table listing_alerts
  add constraint listing_alerts_unique_alert unique (listing_id, watchlist_id, user_id, alert_type);
