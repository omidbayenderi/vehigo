-- Canonical listing foundation. Additive by design: existing ingest and reads
-- continue to work while old rows are normalized by a later backfill job.

alter table market_sources
  add column if not exists country_codes text[] not null default '{}',
  add column if not exists vehicle_types text[] not null default '{}',
  add column if not exists acquisition_modes text[] not null default '{}',
  add column if not exists connector_version text,
  add column if not exists connector_capabilities jsonb not null default '{}'::jsonb;

alter table market_listings
  add column if not exists description text,
  add column if not exists seller_country_code text,
  add column if not exists seller_postal_code text,
  add column if not exists seller_type text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists variant text,
  add column if not exists first_registration_date date,
  add column if not exists vat_deductible boolean,
  add column if not exists body_type text,
  add column if not exists fuel_type text,
  add column if not exists transmission text,
  add column if not exists drive_type text,
  add column if not exists power_hp int,
  add column if not exists engine_cc int,
  add column if not exists emission_class text,
  add column if not exists exterior_color text,
  add column if not exists vin text,
  add column if not exists seat_count int,
  add column if not exists door_count int,
  add column if not exists condition text,
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists published_at timestamptz,
  add column if not exists canonical_schema_version int,
  add column if not exists normalization_confidence numeric(4,3),
  add column if not exists normalization_warnings text[] not null default '{}',
  add column if not exists canonical_fingerprint text,
  add column if not exists normalized_at timestamptz,
  add column if not exists normalization_evidence jsonb not null default '{}'::jsonb;

alter table market_listings
  drop constraint if exists market_listings_seller_country_code_check,
  add constraint market_listings_seller_country_code_check
    check (seller_country_code is null or seller_country_code ~ '^[A-Z]{2}$') not valid,
  drop constraint if exists market_listings_seller_type_check,
  add constraint market_listings_seller_type_check
    check (seller_type is null or seller_type in ('private', 'dealer', 'unknown')) not valid,
  drop constraint if exists market_listings_coordinates_check,
  add constraint market_listings_coordinates_check
    check ((latitude is null or latitude between -90 and 90) and (longitude is null or longitude between -180 and 180)) not valid,
  drop constraint if exists market_listings_fuel_type_check,
  add constraint market_listings_fuel_type_check
    check (fuel_type is null or fuel_type in ('gasoline', 'diesel', 'electric', 'hybrid', 'lpg', 'hydrogen', 'other')) not valid,
  drop constraint if exists market_listings_transmission_check,
  add constraint market_listings_transmission_check
    check (transmission is null or transmission in ('automatic', 'manual', 'semi_automatic', 'other')) not valid,
  drop constraint if exists market_listings_drive_type_check,
  add constraint market_listings_drive_type_check
    check (drive_type is null or drive_type in ('fwd', 'rwd', 'awd', 'other')) not valid,
  drop constraint if exists market_listings_body_type_check,
  add constraint market_listings_body_type_check
    check (body_type is null or body_type in ('sedan', 'suv', 'station_wagon', 'hatchback', 'coupe', 'convertible', 'pickup', 'van', 'tractor_unit', 'rigid_truck', 'other')) not valid,
  drop constraint if exists market_listings_condition_check,
  add constraint market_listings_condition_check
    check (condition is null or condition in ('new', 'used_excellent', 'used_good', 'used_fair', 'damaged')) not valid,
  drop constraint if exists market_listings_canonical_schema_version_check,
  add constraint market_listings_canonical_schema_version_check
    check (canonical_schema_version is null or canonical_schema_version >= 1) not valid,
  drop constraint if exists market_listings_canonical_numeric_fields_check,
  add constraint market_listings_canonical_numeric_fields_check
    check ((power_hp is null or power_hp > 0) and (engine_cc is null or engine_cc > 0) and (seat_count is null or seat_count > 0) and (door_count is null or door_count > 0)) not valid,
  drop constraint if exists market_listings_normalization_confidence_check,
  add constraint market_listings_normalization_confidence_check
    check (normalization_confidence is null or normalization_confidence between 0 and 1) not valid;

create index if not exists market_listings_canonical_fingerprint_idx
  on market_listings (canonical_fingerprint)
  where canonical_fingerprint is not null;
create index if not exists market_listings_vin_idx
  on market_listings (vin)
  where vin is not null;
create index if not exists market_listings_country_type_freshness_idx
  on market_listings (seller_country_code, vehicle_type, last_seen_at desc)
  where status = 'active';
create index if not exists market_listings_canonical_vehicle_idx
  on market_listings (brand, model, year, mileage_km, price)
  where status = 'active';

update market_sources
set country_codes = array['NL'],
    vehicle_types = array['car','van','truck','trailer','bus','other'],
    acquisition_modes = array['permitted_html'],
    connector_version = '1.0.0',
    connector_capabilities = '{"direct_search":true,"incremental_sync":false}'::jsonb
where key = 'marktplaats';

update market_sources
set country_codes = array['EU','GB','CH','NO'],
    vehicle_types = array['car','van','truck','trailer','construction','spare_part','bus','other'],
    acquisition_modes = array['web_index'],
    connector_version = '1.0.0',
    connector_capabilities = tam'{"direct_search":true,"incremental_sync":false}'::jsonb
where key = 'brave_web';
