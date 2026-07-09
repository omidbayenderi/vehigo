-- ========== KAYNAK YÖNTEMİ (scrape vs email_alert) ==========
-- robots.txt + canlı erişim taraması sonucu: 16 adaydan sadece marktplaats hem
-- robots.txt izni hem de teknik erişim (bot koruması yok) açısından uygun çıktı.
-- Diğerleri ya robots.txt ile taramayı yasaklıyor ya da aktif bot koruması
-- (WAF/JS challenge) uyguluyor. Bu kaynaklar 'email_alert' yöntemine (kayıtlı
-- arama + e-posta bildirimi parse etme) geçilene kadar devre dışı bırakıldı.

alter table market_sources
  add column if not exists method text not null default 'scrape' check (method in ('scrape', 'email_alert')),
  add column if not exists notes text;

-- Daha önce eklenen ve robots.txt/teknik kontrolde taramaya kapalı çıkan kaynakları düzelt
update market_sources set enabled = false, method = 'email_alert',
  notes = 'robots.txt sort=/categoryId= parametrelerini genel botlar için yasaklıyor'
  where key = 'truckscout24';
update market_sources set enabled = false, method = 'email_alert',
  notes = 'robots.txt /search/ path''ini yasaklıyor'
  where key = 'autoline';
update market_sources set enabled = false, method = 'email_alert',
  notes = 'robots.txt /lst path''ini yasaklıyor; ayrıca ClaudeBot/GPTBot''u isimle engelliyor'
  where key = 'autoscout24';
update market_sources set enabled = false, method = 'email_alert', min_interval_minutes = 480, jitter_percent = 30,
  notes = 'robots.txt izin veriyor ama teknik olarak WAF 403 (Access denied) döndürüyor'
  where key = 'mobile_de';

-- Marktplaats: robots.txt izin veriyor, canlı test edildi, gerçek erişim var (__NEXT_DATA__ JSON)
insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent, method)
values ('marktplaats', 'Marktplaats', 'https://www.marktplaats.nl', 480, 30, 'scrape')
on conflict (key) do update set enabled = true, method = 'scrape';

-- Diğer araştırılan siteler: ileride email_alert yöntemiyle eklenecek, şimdilik pasif placeholder
insert into market_sources (key, name, base_url, min_interval_minutes, jitter_percent, method, enabled, notes)
values
  ('truck1', 'Truck1', 'https://www.truck1.eu', 480, 30, 'email_alert', false,
    'robots.txt izin veriyor ama JS challenge (bot koruması) ile teknik olarak engelli'),
  ('leboncoin', 'LeBonCoin', 'https://www.leboncoin.fr', 480, 30, 'email_alert', false,
    'robots.txt /recherche path''ini yasaklıyor'),
  ('autotrader_uk', 'AutoTrader UK', 'https://www.autotrader.co.uk', 480, 30, 'email_alert', false,
    'robots.txt car-search/van-search path''lerini yasaklıyor'),
  ('machineryline', 'Machineryline', 'https://www.machineryline.com', 480, 30, 'email_alert', false,
    'robots.txt /search/ path''ini yasaklıyor'),
  ('machineseeker', 'Machineseeker', 'https://www.machineseeker.com', 480, 30, 'email_alert', false,
    'robots.txt sort=/categoryId= parametrelerini yasaklıyor'),
  ('wallapop', 'Wallapop', 'https://www.wallapop.com', 480, 30, 'email_alert', false,
    'robots.txt /search''ı yasaklıyor; AI botlarını isimle engelliyor'),
  ('trucksnl', 'TrucksNL', 'https://www.trucksnl.com', 480, 30, 'email_alert', false,
    'robots.txt genel botlar için /search''ı yasaklıyor'),
  ('mascus', 'Mascus', 'https://www.mascus.com', 480, 30, 'email_alert', false,
    'robots.txt''in kendisi 403 döndürüyor, aktif edge bot koruması var'),
  ('agriaffaires', 'Agriaffaires', 'https://www.agriaffaires.com', 480, 30, 'email_alert', false,
    'robots.txt''in kendisi 403 döndürüyor, aktif edge bot koruması var'),
  ('europe_camions', 'Europe-camions', 'https://www.europe-camions.com', 480, 30, 'email_alert', false,
    'robots.txt kısmi engel içeriyor, ana kategori sayfaları belirsiz')
on conflict (key) do nothing;
