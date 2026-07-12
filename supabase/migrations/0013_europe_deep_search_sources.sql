-- Avrupa deep-search kaynak kataloğu. Bu kayıtların çoğu doğrudan scrape
-- edilmez; Brave web indexi, saved-search e-postası, resmi API veya n8n ingest
-- üzerinden ortak market_listings havuzuna gelir.
insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes)
values
  ('kleinanzeigen', 'Kleinanzeigen (DE)', 'https://www.kleinanzeigen.de', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('olx_pt', 'OLX Portugal', 'https://www.olx.pt', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('olx_pl', 'OLX Poland', 'https://www.olx.pl', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('olx_ro', 'OLX Romania', 'https://www.olx.ro', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('subito_it', 'Subito (IT)', 'https://www.subito.it', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('wallapop_es', 'Wallapop (ES)', 'https://www.wallapop.com', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('otomoto_pl', 'Otomoto (PL)', 'https://www.otomoto.pl', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('willhaben_at', 'Willhaben (AT)', 'https://www.willhaben.at', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('blocket_se', 'Blocket (SE)', 'https://www.blocket.se', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('finn_no', 'FINN (NO)', 'https://www.finn.no', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('dba_dk', 'DBA (DK)', 'https://www.dba.dk', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('nettiauto_fi', 'Nettiauto (FI)', 'https://www.nettiauto.com', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('donedeal_ie', 'DoneDeal (IE)', 'https://www.donedeal.ie', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('hasznaltauto_hu', 'Használtautó (HU)', 'https://www.hasznaltauto.hu', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('njuskalo_hr', 'Njuškalo (HR)', 'https://www.njuskalo.hr', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('bolha_si', 'Bolha (SI)', 'https://www.bolha.com', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('auto24_ee', 'Auto24 (EE)', 'https://www.auto24.ee', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('autoplius_lt', 'Autoplius (LT)', 'https://autoplius.lt', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('ss_lv', 'SS.com (LV)', 'https://www.ss.com', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('bazaraki_cy', 'Bazaraki (CY)', 'https://www.bazaraki.com', 480, 30, 'email_alert', true, 'Saved search, web index veya n8n'),
  ('facebook_public', 'Facebook herkese açık gruplar', 'https://www.facebook.com/groups', 480, 30, 'email_alert', true, 'Yalnızca herkese açık indeks veya yetkili n8n bağlantısı'),
  ('telegram_public', 'Telegram herkese açık kanallar', 'https://t.me', 480, 30, 'email_alert', true, 'Herkese açık kanal indeksi veya n8n')
on conflict (key) do update set enabled = true, notes = excluded.notes;
