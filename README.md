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

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — tip kontrolü

## Notlar

- PDF üretimi `@react-pdf/renderer` + Vazirmatn fontu ile Farsça/RTL destekli olarak yapılır (`lib/pdf-templates/offer-pdf.tsx`).
- Bir teklif için PDF üretilebilmesi, ilgili uyumluluk (compliance) checklist'inin tamamının işaretlenmiş olmasını gerektirir.
