# Vehigo

Avrupa araç keşfi, pazar istihbaratı ve ihracat kararları için üretim odaklı ürün. Next.js (App Router) + Supabase (Postgres, Auth, Storage) üzerine kurulu.

Mevcut mimari ve kapsam detayları için [docs/architecture.md](docs/architecture.md), üretim seviyesindeki altı katmanlı hedef ve teslim sırası için [docs/product-architecture-roadmap.md](docs/product-architecture-roadmap.md) dosyasına bakın.

## Kurulum

1. Bağımlılıkları yükle:

   ```bash
   npm install
   ```

2. Bir Supabase projesi oluştur, ardından `.env.local.example` dosyasını `.env.local` olarak kopyalayıp kendi proje bilgilerinle doldur:

   ```bash
   cp .env.local.example .env.local
   ```

3. `supabase/migrations` altındaki migration dosyalarını numara sırasıyla Supabase SQL Editor'ünde (veya `supabase db push` ile) çalıştır. `0015`–`0019` sırasıyla kanonik veri, connector/ingest operasyonları, Faz 3 arama motoru, Faz 4 pazar istihbaratı ve Faz 5 sürümlü ihracat senaryo motorunu kurar. `0020`, ilk owner hesabını güvenli biçimde başlatır ve kullanıcıların kendi rolünü yükseltebilmesini engeller. `0021`, belge kanıt zincirini ve owner-only nihai senaryo onayını veritabanı seviyesinde zorunlu kılar. `0022`, Faz 6 organizasyon izolasyonu ile genel queue/lease/retry/dead-letter operasyon kontrol düzlemini başlatır. `0023`, ingest/audit organizasyon alanlarını zorunlu kılar ve rol yönetimini organizasyon üyeliği sınırına taşır. `0024`, provider SLO, operasyon alarmı, kullanım bütçesi, rate-limit ve recovery drill kontrol tablolarını/fonksiyonlarını ekler. `0025`, periyodik retention/lease bakımını ve kanıt zorunlu recovery drill yaşam döngüsünü tamamlar.

4. İlk kullanıcıyı Supabase Auth panelinden oluştur — uygulamada kayıt (sign-up) sayfası bilinçli olarak yok, kullanıcılar owner tarafından davet edilir. `0020` çalıştığında sistemde hiç owner yoksa ve tam bir profil varsa bu hesap ilk owner yapılır. Sonraki rol değişiklikleri yalnız owner yetkili `set_user_role` fonksiyonu üzerinden yapılır.

5. Geliştirme sunucusunu başlat:

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) adresinden erişebilirsin.

## Önemli tasarım prensibi

Sistem hiçbir zaman müşteriye otomatik mesaj göndermez. `lib/services/messages.ts` sadece taslak metin üretir/saklar; gönderim her zaman kullanıcının kendi WhatsApp/Telegram hesabından elle yapılması ve ardından "gönderildi" olarak işaretlenmesiyle gerçekleşir.

## Pazar alarmı prensibi

İlan izleme özelliği kullanıcı başına ayrı crawler çalıştırmaz. Her kaynak merkezi ve jitter'lı aralıklarla taranır; yeni ilanlar `market_listings` havuzuna tekilleştirilerek yazılır, ardından kullanıcıların `watchlists` filtreleriyle eşleştirilir. Eşleşen ilanlar tek Telegram botu üzerinden ilgili kullanıcının doğrulanmış Telegram chat'ine dahili alarm olarak gönderilir.

Yeni veya düzenlenmiş bir watchlist önce son görülen 1.000 aktif ilanlık yerel hafif indekse karşı çalışır. Eşleşme yoksa watchlist sürekli tarama emri olarak aktif kalır. Veritabanı kaynak sayfayı ya da görselleri kopyalamaz; yalnız arama/eşleştirme için gereken özet alanları, ilk/son görülme zamanı ve kanonik ilan linkini saklar.

Telegram Bot API kullanıcı adına doğrudan mesaj göndermez; kullanıcı uygulamada Telegram kullanıcı adını kaydeder ve botu Telegram'da başlatarak `chat_id` doğrulamasını tamamlar.

Scanner veya n8n ingest yeni bir eşleşme ürettiğinde bekleyen Telegram alarmlarını aynı çalışmada teslim eder. Telegram henüz bağlanmamışsa alarm başarısız sayılmaz; `pending` kalır ve sonraki çalışma ya da özet gönderiminde tekrar değerlendirilir.

Genel web araması için `brave_web` kaynağı aktif watchlist filtrelerinden adil sırayla sorgu üretir ve Brave Search API sonuçlarını `market_listings` havuzuna ekler. Bu katman 40'tan fazla Avrupa marketplace alan adını, herkese açık Facebook grup gönderilerini ve Telegram kanal sayfalarını kapsar. Özel gruplar yalnızca kullanıcının yetkilendirdiği n8n bağlantısıyla ingest edilebilir.

## Agent ekibi

Pazar alarmı üç dahili agent gibi çalışır:

- **Scout**: Marktplaats, Brave Web Search, saved-search email ve n8n ingest kaynaklarından yeni ilanları bulur.
- **Analyst**: Her ilanı kullanıcının watchlist kriterlerine göre 0-100 fırsat skoruyla puanlar; fiyat, marka/model, yıl, km, konum, keyword, must-have ve hariç kelimeleri hesaba katar.
- **Notifier**: Yeni yüksek potansiyelli ilanları Telegram'a gönderir ve günlük patron özetinde en iyi seçenekleri listeler.

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — tip kontrolü
- `npm run scan:once` — zamanı gelen canlı kaynakları bir kez tara
- `npm run scan:force` — aktif canlı kaynakları due beklemeden bir kez tara

## Arka plan entegrasyonları

- `POST /api/search/plan` — doğal dildeki araç tarifini sürümlü ve kullanıcı tarafından onaylanabilir yapılandırılmış arama planına çevirir.
- `GET /api/search/listings?watchlistId={id}` — kullanıcıya ait watchlist için strict/discovery kurallarını uygular; kararlı sıralanmış, sayfalı ve cross-source duplicate alternatifleri tek kart altında gruplanmış sonuç döndürür. `page`, `pageSize`, `sortBy` ve `sortDirection` parametrelerini kabul eder.
- `GET/POST /api/intelligence/listings/{listingId}` — son kanıt snapshot'ını okur veya karşılaştırılabilir ilan, fiyat dağılımı, örneklem kalitesi ve risk analizini yeniden üretir. POST gövdesindeki `includeAi: true` yapılandırılmış AI kanıt incelemesini ayrı deftere kaydeder; `evaluationType: "damage_review"` yalnız hak kaydında analiz izni bulunan görselleri kullanır.
- `PATCH /api/intelligence/evaluations/{evaluationId}/decision` — AI çıktısına `accepted`, `rejected` veya `needs_review` insan kararı ve gerekçe ekler.
- `GET/POST /api/exports/scenarios` — ihracat senaryolarını listeler veya açık rota, araç, alıcı, para birimi ve maliyet varsayımlarıyla oluşturur.
- `POST /api/exports/scenarios/{scenarioId}/calculate` — aktif kural seti ve kur snapshot’larıyla yeniden üretilebilir landed-cost sonucu üretir.
- `POST /api/exports/scenarios/{scenarioId}/approve` — blokajı olmayan ve zorunlu belgeleri doğrulanmış sonucu insan onayıyla kilitler.
- `PATCH /api/exports/scenarios/{scenarioId}/documents/{documentId}` — belge durumunu ve inceleme izini günceller.
- `GET/POST /api/exports/exchange-rates` — kaynak ve gözlem zamanı belli kur snapshot’larını yönetir.
- `GET/POST /api/exports/rule-sets` — sürümlü, kaynak referanslı maliyet/uygunluk kural setlerini yönetir; aktivasyon yalnız owner rolündedir.
- `POST /api/exports/legacy-offers/{offerId}` — eski İran teklif alanlarını genel maliyet kategorilerine taşıyan yeni bir senaryo oluşturur.

- `POST /api/scanner/ingest` — n8n veya site adapter'ları yeni ilanları merkezi havuza gönderir. `x-scanner-secret` header'ı `SCANNER_INGEST_SECRET` ile eşleşmelidir.
- `GET /api/scanner/ingest/events` — payload içeriğini göstermeden ingest event, hata ve replay durumlarını listeler; `status`, `source` ve `limit` filtrelerini kabul eder.
- `POST /api/scanner/ingest/replay/{eventId}` — başarısız ve payload saklama süresi dolmamış bir ingest event'ini kontrollü şekilde yeniden oynatır.
- `POST /api/scanner/email-alert` — saved-search e-postalarından gelen ilan linklerini merkezi havuza işler. n8n Email Trigger veya mailbox parser bu endpoint'e `source_key`, `subject`, `text`/`html` gönderir.
- `GET /api/scanner/connectors` — kaynak kataloğu ile çalışan connector manifestlerinin sözleşme durumunu gösterir. `POST` aynı endpoint üzerinde runtime manifestlerini kataloğa senkronize eder.
- `GET/POST /api/scanner/run` — deploy cron/scheduler endpoint'i; zamanı gelen canlı kaynakları tarar. Vercel Cron `GET` + `Authorization: Bearer CRON_SECRET`, n8n/manual çağrılar `POST` + `x-scanner-secret` kullanır. İlk dolum/test için `?force=1`, tek kaynak için `?source=marktplaats` veya `?source=brave_web` kullanılabilir.
- `GET/POST /api/scanner/digest` — varsayılan olarak son 12 saatin yeni ve henüz gönderilmemiş fırsatlarını kullanıcı bazlı Telegram özeti olarak gönderir.
- `POST /api/telegram/webhook` — Telegram bot webhook'u; `TELEGRAM_WEBHOOK_SECRET` ayarlanırsa Telegram'ın `X-Telegram-Bot-Api-Secret-Token` header'ı doğrulanır.

Doğrudan scraping sadece robots.txt/teknik erişim açısından güvenli kaynaklarda kullanılır. Diğer Avrupa marketplace kaynakları canlı veriyi resmi API, saved-search e-postası veya n8n adapter ile aynı ingest havuzuna gönderir; kullanıcı filtreleme ve Telegram alarm akışı hepsi için aynıdır.

Connector ve n8n çağrılarının `x-idempotency-key` göndermesi önerilir. Aynı kaynak ve anahtarla gelen aynı payload ikinci kez işlenmez; aynı anahtarla farklı payload gönderilirse `409 idempotency_conflict` döner. Header gönderilmezse sistem payload içeriğinden deterministik SHA-256 anahtarı üretir. İstek gövdesi 1 MB ile sınırlıdır.

Yalnız replay edilebilir başarısız ingest payload'ları kaynak politikasına göre varsayılan 30 gün saklanır. Başarılı ve şema tarafından reddedilmiş event'lerde payload tutulmaz; hash ve operasyonel metadata korunur. Scanner zamanı gelen başarısız event'leri sınırlı sayıda otomatik tekrar dener; yetkili kullanıcı event endpoint'inden durumu görüp replay endpoint'ini manuel olarak da çağırabilir. Süresi dolan payload içeriği temizlenir, operasyonel event kaydı korunur.

## Faz 3 arama davranışı

Watchlist filtreleri artık gizli keyword token'larında değil, indekslenebilir ayrı kolonlarda tutulur. Bir watchlist birden fazla ülke, EU/EEA/Schengen/Balkans hazır ayarı veya koordinat + yarıçap kullanabilir. `strict` modu gerekli alanı bilinmeyen ilanları eler; `discovery` modu ilanı korur ve hangi alanların doğrulanması gerektiğini sonuç metadata'sında açıklar.

Her doğal dil planı parser sürümü, güven puanı, uyarılar ve yapılandırılmış filtrelerle gösterilir; kullanıcı “Bu planı kullan” demeden kaydedilmez. Kanonik fingerprint'i aynı olan cross-source ilanlar silinmez, kalıcı bir duplicate cluster altında tutulur ve tek ana sonuç kartında kaynak alternatifleri olarak gösterilir.

## Faz 4 piyasa istihbaratı davranışı

Piyasa konumu yalnız aynı para birimi ve kanonik marka/modeldeki, kopya kümeleri tekilleştirilmiş benzer ilanlardan hesaplanır. En az 6 uygun ilan ve 2 bağımsız kaynak yoksa sistem “piyasanın altında” gibi ticari bir iddia üretmez; örneklem kalitesini yetersiz/düşük olarak gösterir. Her sonuç seçilen ilan kimlikleri, dışlama nedenleri, hesap sürümü ve SHA-256 kanıt özetiyle yeniden üretilebilir.

AI deterministik hesabın yerine geçmez. Yalnız yeterli snapshot'ı inceler; model, prompt sürümü, girdi kanıtı, token/maliyet, güven ve insan kararı `ai_evaluations` defterinde tutulur. Görsel hasar incelemesine yalnız `listing_media_rights` içinde açıkça izin verilmiş görseller dahil edilebilir.

## Faz 5 ihracat senaryosu davranışı

İhracat hesapları artık `iran_customs_estimate` gibi ülkeye özel bir toplam alanına bağlı değildir. Her senaryo çıkış/hedef, taşıma modu, araç kategorisi, alıcı profili, kural seti sürümü ve kur snapshot’larını sabitler. Kural veya kur bulunmuyorsa hesap sessizce tahmin üretmez; hata veya uygunluk blokajı döndürür.

Kural setleri yalnız kaynak referansıyla aktif hale getirilebilir. Hesap sonucu SHA-256 kanıt özetiyle input, kural, kur ve maliyet kırılımını saklar. Zorunlu belgeler doğrulanmadan senaryo onaylanamaz; onaylanan sonuç teklife bağlanır ve PDF içine aynı kanıt özeti ile hesap/kural sürümü yazılır.

`brave_web` için `.env.local` içinde `BRAVE_SEARCH_API_KEY` gerekir. Google Custom Search JSON API yeni müşterilere kapalı olduğu için yeni kurulumda genel web arama katmanı Brave Search API üzerinden çalışır.

## Otomatik tarama

`.github/workflows/scanner-cron.yml` günde 3 kez `/api/scanner/run`, günde 2 kez de son 12 saatin yeni ilanları için `/api/scanner/digest` çağırır. `.github/workflows/operations-maintenance.yml` ise her 5 dakikada bir expired lease kurtarma ve retention bakımını çalıştırır. GitHub Actions secrets ve Vercel ortam değişkenlerinde şunlar tanımlı olmalı:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SCANNER_INGEST_SECRET`
- `CRON_SECRET`
- `BRAVE_SEARCH_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Vercel Cron, `CRON_SECRET` tanımlıysa `Authorization: Bearer CRON_SECRET` ile doğrulanır. n8n veya manuel test çağrıları için `x-scanner-secret: SCANNER_INGEST_SECRET` header'ı kullanılır.

## Notlar

- PDF üretimi `@react-pdf/renderer` + Vazirmatn fontu ile Farsça/RTL destekli olarak yapılır (`lib/pdf-templates/offer-pdf.tsx`).
- Bir teklif için PDF üretilebilmesi, ilgili uyumluluk (compliance) checklist'inin tamamının işaretlenmiş olmasını gerektirir.
- Üretim bakım ve geri dönüş prosedürü için `docs/operations-recovery-runbook.md` izlenir; service-role scheduler `npm run operations:maintenance` komutunu çalıştırır.
