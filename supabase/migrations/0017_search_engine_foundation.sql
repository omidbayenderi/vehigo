-- Phase 3: indexed search plans, geography, strict/discovery matching, and duplicate clusters.

alter table watchlists
  add column if not exists country_codes text[] not null default '{}',
  add column if not exists region_preset text,
  add column if not exists center_latitude double precision,
  add column if not exists center_longitude double precision,
  add column if not exists radius_km int,
  add column if not exists search_mode text not null default 'discovery',
  add column if not exists freshness_hours int not null default 168,
  add column if not exists sort_by text not null default 'relevance',
  add column if not exists sort_direction text not null default 'desc',
  add column if not exists page_size int not null default 25,
  add column if not exists natural_language_query text,
  add column if not exists search_plan jsonb,
  add column if not exists search_plan_version int not null default 1,
  add column if not exists search_plan_confirmed_at timestamptz,
  add column if not exists seat_count int,
  add column if not exists condition text,
  add column if not exists fuel_type text,
  add column if not exists transmission text,
  add column if not exists body_type text,
  add column if not exists drive_type text,
  add column if not exists seller_type text,
  add column if not exists min_power_hp int,
  add column if not exists max_power_hp int,
  add column if not exists min_engine_cc int,
  add column if not exists max_engine_cc int,
  add column if not exists min_doors int,
  add column if not exists max_doors int,
  add column if not exists emission_class text,
  add column if not exists exterior_color text;

alter table watchlists
  drop constraint if exists watchlists_region_preset_check,
  add constraint watchlists_region_preset_check
    check (region_preset is null or region_preset in ('eu', 'eea', 'schengen', 'balkans')) not valid,
  drop constraint if exists watchlists_search_mode_check,
  add constraint watchlists_search_mode_check
    check (search_mode in ('strict', 'discovery')) not valid,
  drop constraint if exists watchlists_sort_by_check,
  add constraint watchlists_sort_by_check
    check (sort_by in ('relevance', 'newest', 'price', 'mileage', 'year')) not valid,
  drop constraint if exists watchlists_sort_direction_check,
  add constraint watchlists_sort_direction_check
    check (sort_direction in ('asc', 'desc')) not valid,
  drop constraint if exists watchlists_geography_check,
  add constraint watchlists_geography_check check (
    (center_latitude is null and center_longitude is null and radius_km is null)
    or (
      center_latitude between -90 and 90
      and center_longitude between -180 and 180
      and radius_km between 1 and 2000
    )
  ) not valid,
  drop constraint if exists watchlists_search_limits_check,
  add constraint watchlists_search_limits_check
    check (freshness_hours between 1 and 8760 and page_size between 10 and 100) not valid,
  drop constraint if exists watchlists_country_codes_check,
  add constraint watchlists_country_codes_check
    check (country_codes <@ array[
      'AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR',
      'HU','IS','IE','IT','XK','LV','LI','LT','LU','MT','MD','MC','ME','NL','MK','NO',
      'PL','PT','RO','SM','RS','SK','SI','ES','SE','CH','TR','UA','GB','VA'
    ]::text[]) not valid,
  drop constraint if exists watchlists_condition_check,
  add constraint watchlists_condition_check
    check (condition is null or condition in ('new','used_excellent','used_good','used_fair','damaged')) not valid,
  drop constraint if exists watchlists_fuel_type_check,
  add constraint watchlists_fuel_type_check
    check (fuel_type is null or fuel_type in ('gasoline','diesel','electric','hybrid','lpg','hydrogen','other')) not valid,
  drop constraint if exists watchlists_transmission_check,
  add constraint watchlists_transmission_check
    check (transmission is null or transmission in ('automatic','manual','semi_automatic')) not valid,
  drop constraint if exists watchlists_body_type_check,
  add constraint watchlists_body_type_check
    check (body_type is null or body_type in ('sedan','suv','station_wagon','hatchback','coupe','convertible','pickup','van')) not valid,
  drop constraint if exists watchlists_drive_type_check,
  add constraint watchlists_drive_type_check
    check (drive_type is null or drive_type in ('fwd','rwd','awd')) not valid,
  drop constraint if exists watchlists_seller_type_check,
  add constraint watchlists_seller_type_check
    check (seller_type is null or seller_type in ('private','dealer')) not valid,
  drop constraint if exists watchlists_detail_ranges_check,
  add constraint watchlists_detail_ranges_check check (
    (seat_count is null or seat_count between 1 and 100)
    and (min_power_hp is null or min_power_hp between 1 and 3000)
    and (max_power_hp is null or max_power_hp between 1 and 3000)
    and (min_engine_cc is null or min_engine_cc between 50 and 30000)
    and (max_engine_cc is null or max_engine_cc between 50 and 30000)
    and (min_doors is null or min_doors between 1 and 10)
    and (max_doors is null or max_doors between 1 and 10)
    and (min_power_hp is null or max_power_hp is null or min_power_hp <= max_power_hp)
    and (min_engine_cc is null or max_engine_cc is null or min_engine_cc <= max_engine_cc)
    and (min_doors is null or max_doors is null or min_doors <= max_doors)
  ) not valid;

-- Backfill the former single-country field where it can be mapped safely.
update watchlists
set country_codes = array[case lower(trim(country))
  when 'almanya' then 'DE' when 'germany' then 'DE' when 'deutschland' then 'DE'
  when 'hollanda' then 'NL' when 'netherlands' then 'NL' when 'nederland' then 'NL'
  when 'belçika' then 'BE' when 'belgium' then 'BE' when 'belgië' then 'BE'
  when 'fransa' then 'FR' when 'france' then 'FR'
  when 'italya' then 'IT' when 'italy' then 'IT' when 'italia' then 'IT'
  when 'ispanya' then 'ES' when 'spain' then 'ES' when 'españa' then 'ES'
  when 'avusturya' then 'AT' when 'austria' then 'AT' when 'österreich' then 'AT'
  when 'polonya' then 'PL' when 'poland' then 'PL' when 'polska' then 'PL'
  when 'portekiz' then 'PT' when 'portugal' then 'PT'
  when 'romanya' then 'RO' when 'romania' then 'RO'
  when 'bulgaristan' then 'BG' when 'bulgaria' then 'BG'
  when 'çekya' then 'CZ' when 'czechia' then 'CZ' when 'czech republic' then 'CZ'
  when 'isveç' then 'SE' when 'sweden' then 'SE'
  when 'norveç' then 'NO' when 'norway' then 'NO'
  when 'danimarka' then 'DK' when 'denmark' then 'DK'
  when 'finlandiya' then 'FI' when 'finland' then 'FI'
  when 'yunanistan' then 'GR' when 'greece' then 'GR'
  when 'irlanda' then 'IE' when 'ireland' then 'IE'
  when 'birleşik krallık' then 'GB' when 'united kingdom' then 'GB' when 'uk' then 'GB'
end]
where cardinality(country_codes) = 0
  and country is not null
  and lower(trim(country)) in (
    'almanya','germany','deutschland','hollanda','netherlands','nederland','belçika','belgium','belgië',
    'fransa','france','italya','italy','italia','ispanya','spain','españa','avusturya','austria','österreich',
    'polonya','poland','polska','portekiz','portugal','romanya','romania','bulgaristan','bulgaria',
    'çekya','czechia','czech republic','isveç','sweden','norveç','norway','danimarka','denmark',
    'finlandiya','finland','yunanistan','greece','irlanda','ireland','birleşik krallık','united kingdom','uk'
  );

-- Decode legacy hidden metadata into first-class, queryable columns.
update watchlists set
  seat_count = coalesce(seat_count, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_seat:([0-9]+)'), '')::int),
  condition = coalesce(condition, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_condition:([a-z_]+)'), '')),
  fuel_type = coalesce(fuel_type, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:fuel_type:([^ ]+)'), '')),
  transmission = coalesce(transmission, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:transmission:([^ ]+)'), '')),
  body_type = coalesce(body_type, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:body_type:([^ ]+)'), '')),
  drive_type = coalesce(drive_type, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:drive_type:([^ ]+)'), '')),
  seller_type = coalesce(seller_type, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:seller_type:([^ ]+)'), '')),
  min_power_hp = coalesce(min_power_hp, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:min_power_hp:([0-9]+)'), '')::int),
  max_power_hp = coalesce(max_power_hp, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:max_power_hp:([0-9]+)'), '')::int),
  min_engine_cc = coalesce(min_engine_cc, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:min_engine_cc:([0-9]+)'), '')::int),
  max_engine_cc = coalesce(max_engine_cc, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:max_engine_cc:([0-9]+)'), '')::int),
  min_doors = coalesce(min_doors, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:min_doors:([0-9]+)'), '')::int),
  max_doors = coalesce(max_doors, nullif(substring(array_to_string(must_have_keywords, ' ') from '__vehigo_filter:max_doors:([0-9]+)'), '')::int),
  emission_class = coalesce(emission_class, (
    select nullif(substring(keyword from '^__vehigo_filter:emission_class:(.*)$'), '')
    from unnest(must_have_keywords) as keyword
    where keyword like '__vehigo_filter:emission_class:%'
    limit 1
  )),
  exterior_color = coalesce(exterior_color, (
    select nullif(substring(keyword from '^__vehigo_filter:exterior_color:(.*)$'), '')
    from unnest(must_have_keywords) as keyword
    where keyword like '__vehigo_filter:exterior_color:%'
    limit 1
  ));

update watchlists
set must_have_keywords = coalesce((
  select array_agg(keyword order by ordinal)
  from unnest(must_have_keywords) with ordinality as item(keyword, ordinal)
  where keyword not like '__vehigo_%'
), '{}');

create index if not exists watchlists_country_codes_idx on watchlists using gin (country_codes);
create index if not exists watchlists_active_freshness_idx on watchlists (active, freshness_hours);
create index if not exists market_listings_search_country_type_idx
  on market_listings (seller_country_code, vehicle_type, status, last_seen_at desc);
create index if not exists market_listings_search_price_idx
  on market_listings (currency, price, id) where status = 'active';
create index if not exists market_listings_search_year_mileage_idx
  on market_listings (year desc, mileage_km, id) where status = 'active';
create index if not exists market_listings_location_idx
  on market_listings (latitude, longitude) where latitude is not null and longitude is not null;

create table if not exists listing_duplicate_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_key text not null unique,
  match_strategy text not null default 'canonical_fingerprint_v1',
  confidence numeric(4,3) not null default 0.850 check (confidence between 0 and 1),
  primary_listing_id uuid references market_listings(id) on delete set null,
  member_count int not null default 0 check (member_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table market_listings
  add column if not exists duplicate_cluster_id uuid references listing_duplicate_clusters(id) on delete set null;

create index if not exists market_listings_duplicate_cluster_idx
  on market_listings (duplicate_cluster_id, status, last_seen_at desc);

drop trigger if exists listing_duplicate_clusters_set_updated_at on listing_duplicate_clusters;
create trigger listing_duplicate_clusters_set_updated_at before update on listing_duplicate_clusters
  for each row execute function set_updated_at();

create or replace function assign_market_listing_duplicate_cluster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_cluster_id uuid;
begin
  if new.canonical_fingerprint is null or new.canonical_fingerprint = '' then
    return new;
  end if;

  insert into listing_duplicate_clusters (cluster_key, confidence)
  values (
    new.canonical_fingerprint,
    case when new.vin is not null then 1.000 else 0.850 end
  )
  on conflict (cluster_key) do update
    set confidence = greatest(listing_duplicate_clusters.confidence, excluded.confidence)
  returning id into target_cluster_id;

  new.duplicate_cluster_id := target_cluster_id;
  return new;
end;
$$;

drop trigger if exists market_listings_assign_duplicate_cluster on market_listings;
create trigger market_listings_assign_duplicate_cluster
  before insert or update of canonical_fingerprint, vin on market_listings
  for each row execute function assign_market_listing_duplicate_cluster();

create or replace function refresh_listing_duplicate_cluster_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_cluster_id uuid;
  affected_cluster_ids uuid[];
begin
  if tg_op = 'INSERT' then
    affected_cluster_ids := array[new.duplicate_cluster_id];
  elsif tg_op = 'DELETE' then
    affected_cluster_ids := array[old.duplicate_cluster_id];
  else
    affected_cluster_ids := array[new.duplicate_cluster_id, old.duplicate_cluster_id];
  end if;

  foreach affected_cluster_id in array affected_cluster_ids loop
    if affected_cluster_id is null then continue; end if;
    update listing_duplicate_clusters cluster set
      member_count = members.member_count,
      primary_listing_id = members.primary_listing_id
    from (
      select
        count(*)::int as member_count,
        (array_agg(id order by (status = 'active') desc, normalization_confidence desc nulls last, last_seen_at desc, id))[1] as primary_listing_id
      from market_listings
      where duplicate_cluster_id = affected_cluster_id
    ) members
    where cluster.id = affected_cluster_id;
  end loop;

  return null;
end;
$$;

drop trigger if exists market_listings_refresh_duplicate_cluster_stats_write on market_listings;
create trigger market_listings_refresh_duplicate_cluster_stats_write
  after insert or delete on market_listings
  for each row execute function refresh_listing_duplicate_cluster_stats();
drop trigger if exists market_listings_refresh_duplicate_cluster_stats_update on market_listings;
create trigger market_listings_refresh_duplicate_cluster_stats_update
  after update of duplicate_cluster_id, status, normalization_confidence, last_seen_at on market_listings
  for each row execute function refresh_listing_duplicate_cluster_stats();

-- Assign existing canonical rows after the trigger exists.
update market_listings
set canonical_fingerprint = canonical_fingerprint
where canonical_fingerprint is not null and duplicate_cluster_id is null;

alter table listing_duplicate_clusters enable row level security;
drop policy if exists "listing duplicate clusters readable by authenticated" on listing_duplicate_clusters;
create policy "listing duplicate clusters readable by authenticated" on listing_duplicate_clusters
  for select using (auth.role() = 'authenticated');
