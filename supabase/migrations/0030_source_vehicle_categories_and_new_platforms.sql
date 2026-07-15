-- Tags every catalog source with a high-level vehicle category so the UI can
-- group "Kaynak tarama politikası" instead of showing one long flat list, and
-- adds five specialist European marketplaces that were missing from the
-- catalog (heavy-commercial and construction/agri equipment coverage).
alter table market_sources
  add column if not exists vehicle_category text
  check (vehicle_category in ('car_light_commercial', 'heavy_commercial', 'construction_agri', 'general'))
  default 'general';

update market_sources set vehicle_category = 'car_light_commercial'
where key in (
  'mobile_de', 'autoscout24', 'leboncoin', 'subito_it', 'marktplaats', 'wallapop_es',
  'kleinanzeigen', 'olx_pt', 'olx_pl', 'olx_ro', 'otomoto_pl', 'willhaben_at',
  'blocket_se', 'finn_no', 'dba_dk', 'nettiauto_fi', 'donedeal_ie', 'hasznaltauto_hu',
  'njuskalo_hr', 'bolha_si', 'auto24_ee', 'autoplius_lt', 'ss_lv', 'bazaraki_cy', 'autotrader_uk'
);

update market_sources set vehicle_category = 'heavy_commercial'
where key in ('truckscout24', 'autoline', 'truck1', 'trucksnl', 'bas_world', 'kleyn_trucks', 'alle_lkw_de');

update market_sources set vehicle_category = 'construction_agri'
where key in ('machineryline', 'machineseeker', 'mascus', 'agriaffaires', 'europe_camions');

update market_sources set vehicle_category = 'general'
where key in ('brave_web', 'facebook_public', 'telegram_public');

insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes, vehicle_category)
values
  ('truckstore', 'TruckStore (Daimler Truck)', 'https://www.truckstore.com', 480, 30, 'email_alert', true, 'Mercedes-Benz sertifikalı ikinci el ağır vasıta ağı — saved search, web index veya n8n', 'heavy_commercial'),
  ('machinerypark', 'Machinerypark', 'https://www.machinerypark.com', 480, 30, 'email_alert', true, 'İş makineleri / inşaat ekipmanı pazaryeri — saved search, web index veya n8n', 'construction_agri'),
  ('machinery_portal', 'Machinery-Portal', 'https://www.machinery-portal.com', 480, 30, 'email_alert', true, 'Gebrauchte Baumaschinen pazaryeri — saved search, web index veya n8n', 'construction_agri'),
  ('traktorpool', 'Traktorpool', 'https://www.traktorpool.de', 480, 30, 'email_alert', true, 'Tarım makineleri / traktör pazaryeri — saved search, web index veya n8n', 'construction_agri'),
  ('ritchie_bros', 'Ritchie Bros. Auctioneers (Europe)', 'https://www.rbauction.eu', 480, 30, 'email_alert', true, 'İş makinesi açık artırma platformu — saved search, web index veya n8n', 'construction_agri')
on conflict (key) do update set enabled = true, notes = excluded.notes, vehicle_category = excluded.vehicle_category;

-- Mirrors the one-canonical-agent-per-host derivation from migration 0027 for
-- just the five newly added sources.
insert into public.site_search_agents (source_key, host, interval_minutes, jitter_percent, status)
select
  source.key,
  regexp_replace(lower(split_part(split_part(source.base_url, '://', 2), '/', 1)), '^www\.', ''),
  greatest(480, source.min_interval_minutes),
  least(100, source.jitter_percent),
  case when source.catalog_status in ('blocked','retired') then 'blocked' else 'pending_activation' end
from public.market_sources source
where source.key in ('truckstore', 'machinerypark', 'machinery_portal', 'traktorpool', 'ritchie_bros')
on conflict (source_key) do update
set host = excluded.host,
    interval_minutes = excluded.interval_minutes,
    jitter_percent = excluded.jitter_percent;
