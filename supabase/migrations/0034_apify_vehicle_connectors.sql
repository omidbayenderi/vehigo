-- Apify vehicle Actors are direct, pay-per-result discovery connectors. They
-- run at most daily and their results are processed transiently by the app.
alter table market_sources
  drop constraint if exists market_sources_method_check;

alter table market_sources
  add constraint market_sources_method_check
  check (method in ('scrape', 'email_alert', 'web_search', 'api'));

insert into market_sources (
  key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes
)
values
  ('apify_mobile_de', 'Mobile.de via Apify', 'https://mobile.de', 1440, 5, 'api', true,
   'Pay-per-result Apify Actor; transient processing; maximum result count controlled by APIFY_MAX_RESULTS_PER_RUN.'),
  ('apify_autoscout24', 'AutoScout24 Europe via Apify', 'https://autoscout24.com', 1440, 5, 'api', true,
   'Pay-per-result Apify Actor; transient processing; maximum result count controlled by APIFY_MAX_RESULTS_PER_RUN.')
on conflict (key) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  min_interval_minutes = excluded.min_interval_minutes,
  jitter_percent = excluded.jitter_percent,
  method = excluded.method,
  enabled = excluded.enabled,
  notes = excluded.notes;
