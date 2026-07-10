-- ========== TÜM PAZAR KAYNAKLARINI CANLI İNGEST İÇİN AÇ ==========
-- Doğrudan scraping sadece method='scrape' kaynaklarında çalışır.
-- method='email_alert' kaynakları canlı veriyi saved-search e-postası, resmi API
-- veya n8n adapter üzerinden /api/scanner/ingest ya da /api/scanner/email-alert
-- endpoint'lerine göndererek sisteme dahil eder.

update market_sources
set enabled = true
where method in ('scrape', 'email_alert');

insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes)
values
  ('kleyn_trucks', 'Kleyn Trucks', 'https://www.kleyntrucks.com', 480, 30, 'email_alert', true,
    'Saved-search/email veya resmi feed üzerinden ingest edilmeli'),
  ('bas_world', 'BAS World', 'https://www.basworld.com', 480, 30, 'email_alert', true,
    'Saved-search/email veya resmi feed üzerinden ingest edilmeli')
on conflict (key) do update set enabled = true;
