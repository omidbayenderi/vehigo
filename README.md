# Vehigo

Araç ihracat komisyonculuğu (Avrupa → İran) için MVP iç aracı. Next.js (App Router) + Supabase (Postgres, Auth, Storage) üzerine kurulu.

Mimari ve kapsam detayları için [docs/architecture.md](docs/architecture.md) dosyasına bakın.

## Kurulum

1. Bağımlılıkları yükle:

   ```bash
   npm install
   ```

2. Bir Supabase projesi oluştur, ardından `.env.local.example` dosyasını `.env.local` olarak kopyalayıp kendi proje bilgilerinle doldur:

   ```bash
   cp .env.local.example .env.local
   ```

3. `supabase/migrations/0001_init.sql` dosyasını Supabase projenin SQL Editor'ünde (veya `supabase db push` ile) çalıştır. Bu migration tüm tabloları, RLS politikalarını ve storage bucket'larını (`vehicle-images`, `offer-pdfs`) oluşturur.

4. İlk kullanıcıyı (owner) Supabase Auth panelinden elle oluştur — uygulamada kayıt (sign-up) sayfası bilinçli olarak yok, kullanıcılar owner tarafından davet edilir. Kullanıcı oluşturulduktan sonra `users_profile` tablosunda ilgili satırın `role` alanını `owner` olarak güncelle.

5. Geliştirme sunucusunu başlat:

   ```bash
   npm run dev
   ```

   [http://localhost:3000](http://localhost:3000) adresinden erişebilirsin.

## Önemli tasarım prensibi

Sistem hiçbir zaman müşteriye otomatik mesaj göndermez. `lib/services/messages.ts` sadece taslak metin üretir/saklar; gönderim her zaman kullanıcının kendi WhatsApp/Telegram hesabından elle yapılması ve ardından "gönderildi" olarak işaretlenmesiyle gerçekleşir.

## Pazar alarmı prensibi

İlan izleme özelliği kullanıcı başına ayrı crawler çalıştırmaz. Her kaynak merkezi ve jitter'lı aralıklarla taranır; yeni ilanlar `market_listings` havuzuna tekilleştirilerek yazılır, ardından kullanıcıların `watchlists` filtreleriyle eşleştirilir. Eşleşen ilanlar tek Telegram botu üzerinden ilgili kullanıcının doğrulanmış Telegram chat'ine dahili alarm olarak gönderilir.

Telegram Bot API kullanıcı adına doğrudan mesaj göndermez; kullanıcı uygulamada Telegram kullanıcı adını kaydeder ve botu Telegram'da başlatarak `chat_id` doğrulamasını tamamlar.

Genel web araması için `brave_web` kaynağı aktif watchlist filtrelerinden sorgu üretir ve Brave Search API üzerinden son 24 saatlik web sonuçlarını `market_listings` havuzuna ekler. Bu katman, bilinen 16 marketplace dışındaki ilan sayfalarını da yakalamak için kullanılır.

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

- `POST /api/scanner/ingest` — n8n veya site adapter'ları yeni ilanları merkezi havuza gönderir. `x-scanner-secret` header'ı `SCANNER_INGEST_SECRET` ile eşleşmelidir.
- `POST /api/scanner/email-alert` — saved-search e-postalarından gelen ilan linklerini merkezi havuza işler. n8n Email Trigger veya mailbox parser bu endpoint'e `source_key`, `subject`, `text`/`html` gönderir.
- `GET/POST /api/scanner/run` — deploy cron/scheduler endpoint'i; zamanı gelen canlı kaynakları tarar. Vercel Cron `GET` + `Authorization: Bearer CRON_SECRET`, n8n/manual çağrılar `POST` + `x-scanner-secret` kullanır. İlk dolum/test için `?force=1`, tek kaynak için `?source=marktplaats` veya `?source=brave_web` kullanılabilir.
- `GET/POST /api/scanner/digest` — son 24 saatin en yüksek skorlu fırsatlarını kullanıcı bazlı Telegram özeti olarak gönderir.
- `POST /api/telegram/webhook` — Telegram bot webhook'u; `TELEGRAM_WEBHOOK_SECRET` ayarlanırsa Telegram'ın `X-Telegram-Bot-Api-Secret-Token` header'ı doğrulanır.

Doğrudan scraping sadece robots.txt/teknik erişim açısından güvenli kaynaklarda kullanılır. Diğer Avrupa marketplace kaynakları canlı veriyi resmi API, saved-search e-postası veya n8n adapter ile aynı ingest havuzuna gönderir; kullanıcı filtreleme ve Telegram alarm akışı hepsi için aynıdır.

`brave_web` için `.env.local` içinde `BRAVE_SEARCH_API_KEY` gerekir. Google Custom Search JSON API yeni müşterilere kapalı olduğu için yeni kurulumda genel web arama katmanı Brave Search API üzerinden çalışır.

## Otomatik tarama

`vercel.json` günde 3 kez `/api/scanner/run`, günde 1 kez `/api/scanner/digest` çağıracak şekilde ayarlandı. Vercel ortam değişkenlerinde şunlar tanımlı olmalı:

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
