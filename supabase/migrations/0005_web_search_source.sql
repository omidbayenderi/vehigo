-- ========== GENEL WEB ARAMA KAYNAĞI ==========
-- Google benzeri genel web indeksinden ilan linkleri bulmak için kullanılır.

alter table market_sources
  drop constraint if exists market_sources_method_check;

alter table market_sources
  add constraint market_sources_method_check
  check (method in ('scrape', 'email_alert', 'web_search'));

insert into market_sources (
  key,
  name,
  base_url,
  min_interval_minutes,
  jitter_percent,
  method,
  enabled,
  notes
)
values (
  'brave_web',
  'Brave Web Search',
  'https://api.search.brave.com',
  480,
  30,
  'web_search',
  true,
  'Genel web arama API katmanı; aktif watchlist filtrelerinden sorgu üretir'
)
on conflict (key) do update set
  enabled = true,
  method = 'web_search',
  min_interval_minutes = excluded.min_interval_minutes,
  jitter_percent = excluded.jitter_percent,
  notes = excluded.notes;
