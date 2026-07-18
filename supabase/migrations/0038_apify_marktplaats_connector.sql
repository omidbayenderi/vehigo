-- Marktplaats via a third-party Apify Actor. Marktplaats' own terms (art.
-- 1.7.3) restrict systematic reuse of the listings database without a
-- written API partnership; this is an accepted operator risk, not a
-- documented exemption, so it is catalogued like the other pay-per-result
-- Apify connectors rather than the dormant direct HTML parser.
insert into market_sources (
  key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes
)
values
  ('apify_marktplaats', 'Marktplaats.nl via Apify', 'https://marktplaats.nl', 1440, 5, 'api', true,
   'Pay-per-result Apify Actor; operator-accepted ToS risk (see art. 1.7.3); maximum result count controlled by APIFY_MAX_RESULTS_PER_RUN.')
on conflict (key) do update set
  name = excluded.name,
  base_url = excluded.base_url,
  min_interval_minutes = excluded.min_interval_minutes,
  jitter_percent = excluded.jitter_percent,
  method = excluded.method,
  enabled = excluded.enabled,
  notes = excluded.notes;
