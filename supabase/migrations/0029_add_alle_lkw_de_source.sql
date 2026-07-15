-- Adds Alle-LKW (DE), a German heavy-vehicle/truck marketplace, to the deep
-- search catalog. Like the other catalog entries added in 0013, this is not
-- scraped directly; it is discovered through the Brave web-index site agent.
insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes)
values
  ('alle_lkw_de', 'Alle-LKW (DE)', 'https://www.alle-lkw.de', 480, 30, 'email_alert', true, 'Ağır vasıta / LKW pazaryeri — saved search, web index veya n8n')
on conflict (key) do update set enabled = true, notes = excluded.notes;

-- Mirrors the one-canonical-agent-per-host derivation from migration 0027 so
-- this newly added source gets a site_search_agents row without needing to
-- rerun that migration's bulk backfill.
insert into public.site_search_agents (source_key, host, interval_minutes, jitter_percent, status)
select
  source.key,
  regexp_replace(lower(split_part(split_part(source.base_url, '://', 2), '/', 1)), '^www\.', ''),
  greatest(480, source.min_interval_minutes),
  least(100, source.jitter_percent),
  case when source.catalog_status in ('blocked','retired') then 'blocked' else 'pending_activation' end
from public.market_sources source
where source.key = 'alle_lkw_de'
on conflict (source_key) do update
set host = excluded.host,
    interval_minutes = excluded.interval_minutes,
    jitter_percent = excluded.jitter_percent;
