# Araç İhracat Komisyonculuğu (Avrupa → İran) — MVP Teknik Mimari

## 0. Özet

Bu doküman, Avrupa'dan İran'a kamyon/ağır vasıta/yedek parça komisyonculuğu yapan bir işletme için MVP seviyesinde iç araç (internal tool) mimarisini tanımlar. Sistem **kendi sermayeni riske atmadan** aracı rolünü destekler: araç bulma, alıcı bulma, eşleştirme, maliyet hesaplama, teklif üretme. Müşteriyle iletişim **her zaman insan onaylı** kalır — otomatik mesaj gönderimi MVP'de yok.

Önerilen stack aynen kullanılabilir: **Next.js + Supabase (Postgres, Auth, Storage) + Server Actions**. Bu, tek kişilik/az kişilik bir ekip için hızlı geliştirme ve düşük operasyonel yük sağlar.

---

## 1. Sistem Mimarisi Genel Bakış

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS (App Router)                     │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │  Dashboard UI │ │  CRM Pipeline │ │  Offer Builder / PDF   │  │
│  └───────────────┘ └───────────────┘ └───────────────────────┘  │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │ Vehicle Table │ │  Lead Table   │ │  Matching / Score UI   │  │
│  └───────────────┘ └───────────────┘ └───────────────────────┘  │
└───────────────────────────┬───────────────────────────────────┘
                            │ Server Actions / Route Handlers
┌───────────────────────────┴───────────────────────────────────┐
│                        SERVICE LAYER (lib/services)             │
│  vehicles.ts   leads.ts   matching.ts   offers.ts   pdf.ts       │
│  compliance.ts   messages.ts (draft-only)   audit.ts             │
└───────────────────────────┬───────────────────────────────────┘
                            │
┌───────────────────────────┴───────────────────────────────────┐
│                          SUPABASE                                │
│  Postgres (RLS)   Auth   Storage (images, PDFs)   Edge Functions │
└─────────────────────────────────────────────────────────────────┘
                            │ (Faz 2+)
┌───────────────────────────┴───────────────────────────────────┐
│      n8n / Make (scraping tetikleyici, hatırlatmalar, vb.)       │
│      AI servisi (eşleştirme önerisi, mesaj taslağı, skorlama)    │
└─────────────────────────────────────────────────────────────────┘
```

**Temel prensip:** Her "otomasyon" bir öneri/taslak üretir; gönderim/onay/karar insan tarafından tıklanarak yapılır. Bu, hem `human_approval_layer`'ı hem de risk yönetimini basitleştirir.

---

## 2. Veritabanı Şeması (Postgres / Supabase)

```sql
-- ========== ORTAK ==========
create table users_profile (
  id uuid primary key references auth.users(id),
  full_name text,
  role text check (role in ('owner','broker','assistant')) default 'broker',
  created_at timestamptz default now()
);

-- ========== 1. ARAÇ İLANLARI ==========
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  source_site text,                 -- mobile.de, truckscout24, autoline vb.
  listing_url text,
  seller_name text,
  seller_country text,
  brand text,
  model text,
  year int,
  mileage_km int,
  price numeric(12,2),
  currency text default 'EUR',
  vat_status text check (vat_status in ('vat_included','vat_free','margin_scheme','unknown')),
  vehicle_type text check (vehicle_type in ('truck','trailer','construction','spare_part','bus','other')),
  tech_specs jsonb,                 -- motor, dingil sayısı, hp, vites vb. serbest alan
  euro_class text,                  -- Euro 5, Euro 6...
  condition text check (condition in ('new','used_excellent','used_good','used_fair','damaged')),
  availability_status text check (availability_status in ('available','reserved','sold','expired')) default 'available',
  notes text,
  created_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid references vehicles(id) on delete cascade,
  storage_path text not null,       -- Supabase Storage yolu
  is_primary boolean default false,
  sort_order int default 0
);

-- ========== 2. MÜŞTERİ / LEAD ==========
create table leads (
  id uuid primary key default gen_random_uuid(),
  company_or_name text not null,
  city text,
  phone_whatsapp text,
  telegram_handle text,
  instagram_handle text,
  business_type text,                -- filo sahibi, ikinci el bayii, bireysel vb.
  desired_vehicle_type text,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  budget_currency text default 'EUR',
  source text check (source in ('instagram','telegram','divar','sheypoor','google_maps','referral','manual')),
  seriousness_score int check (seriousness_score between 0 and 100) default 0,
  status text check (status in
    ('new','contacted','interested','vehicle_proposed','offer_sent',
     'deposit_requested','in_progress','closed_won','closed_lost')) default 'new',
  last_contact_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table lead_activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  activity_type text,                -- 'note','status_change','manual_contact','offer_sent'
  detail text,
  performed_by uuid references users_profile(id),
  created_at timestamptz default now()
);

-- ========== 3. EŞLEŞTİRME ==========
create table matches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete cascade,
  match_score int check (match_score between 0 and 100),
  match_reasoning jsonb,             -- hangi kriterler tuttu/tutmadı
  created_at timestamptz default now(),
  unique (lead_id, vehicle_id)
);

-- ========== 4. TEKLİF / MALİYET ==========
create table offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  vehicle_id uuid references vehicles(id),
  base_vehicle_price numeric(12,2),
  export_company_fee numeric(12,2) default 0,
  transport_cost numeric(12,2) default 0,
  insurance_cost numeric(12,2) default 0,
  iran_customs_estimate numeric(12,2) default 0,
  internal_service_fee numeric(12,2) default 0,
  commission_type text check (commission_type in ('fixed','percentage')) default 'fixed',
  commission_value numeric(12,2) default 0,   -- tutar ya da yüzde
  commission_amount_calculated numeric(12,2), -- hesaplanmış son değer
  final_customer_price numeric(12,2),         -- toplam
  currency text default 'EUR',
  validity_date date,
  delivery_terms text,
  payment_steps text,
  status text check (status in ('draft','sent','accepted','rejected','expired')) default 'draft',
  pdf_storage_path text,
  created_by uuid references users_profile(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== 5. UYUMLULUK / RİSK ==========
create table compliance_checklist (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references offers(id) on delete cascade,
  export_legality_checked boolean default false,
  sanctioned_entity_check_done boolean default false,
  vehicle_category_allowed boolean default false,
  documents_checked boolean default false,
  customs_partner_confirmed boolean default false,
  payment_method_agreed boolean default false,
  buyer_identity_verified boolean default false,
  reviewed_by uuid references users_profile(id),
  reviewed_at timestamptz,
  all_clear boolean generated always as (
    export_legality_checked and sanctioned_entity_check_done and
    vehicle_category_allowed and documents_checked and
    customs_partner_confirmed and payment_method_agreed and
    buyer_identity_verified
  ) stored
);

-- ========== 6. MESAJ TASLAKLARI (insan onaylı) ==========
create table message_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  offer_id uuid references offers(id),
  channel text check (channel in ('whatsapp','telegram','instagram')),
  draft_text text,                    -- Farsça taslak
  status text check (status in ('draft','approved','sent','discarded')) default 'draft',
  approved_by uuid references users_profile(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- ========== AUDIT ==========
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users_profile(id),
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
```

**Notlar:**
- `commission_amount_calculated` ve `final_customer_price` uygulama katmanında hesaplanıp yazılır (trigger yerine service layer'da — hesaplama mantığı değişebileceği için esnek tutulur).
- `compliance_checklist.all_clear` generated column olarak otomatik hesaplanır; teklif PDF'i üretilmeden önce bu alan kontrol edilir.
- `message_drafts.status = 'sent'` sadece kullanıcı elle "gönderdim" işaretlediğinde değişir; sistem hiçbir zaman kendi başına bu durumu set etmez.

---

## 3. Ana Kullanıcı Akışları

### Akış A — Yeni araç ekleme
1. Kullanıcı CSV yükler veya manuel form doldurur → `vehicles` + `vehicle_images`
2. Sistem otomatik olarak mevcut aktif lead'lerle eşleştirme skorunu hesaplar (arka planda, opsiyonel)
3. Araç listede görünür, durumu `available`

### Akış B — Yeni lead ekleme
1. Manuel giriş veya (Faz 2) sosyal medya/Google Maps kaynaklı toplu import
2. Kullanıcı `seriousness_score` girer veya sistem basit kural tabanlı öneri sunar (bütçe belirtilmiş mi, iletişim bilgisi tam mı, geçmiş temas var mı)
3. Lead `new` durumunda pipeline'a düşer

### Akış C — Eşleştirme
1. Kullanıcı bir lead açar → "Uygun araçları göster" butonuna basar
2. Sistem filtre + skor algoritmasıyla sıralanmış aday listesi döner
3. Kullanıcı bir aracı seçip lead durumunu `vehicle_proposed` yapar

### Akış D — Teklif oluşturma
1. Seçili lead + araç ile "Teklif Oluştur" başlatılır
2. Maliyet kalemleri formu açılır (hepsi düzenlenebilir, default şablon değerleriyle önceden doldurulmuş)
3. Komisyon tipi seçilir (sabit/yüzde) → sistem `final_customer_price` hesaplar
4. **Compliance checklist zorunlu** — tüm kutular işaretlenmeden PDF üretilemez (UI'da net uyarı)
5. PDF (Farsça) ve WhatsApp özet metni üretilir → Storage'a kaydedilir
6. Lead durumu `offer_sent` olur (PDF gerçekten paylaşıldıysa, manuel onay sonrası)

### Akış E — Mesaj taslağı ve onay
1. Kullanıcı "Mesaj taslağı oluştur" der (teklif bağlamına göre, Farsça)
2. Taslak `message_drafts` tablosuna `draft` statüsüyle yazılır
3. Kullanıcı taslağı düzenler, onaylar (`approved`) → **kopyalar ve kendi WhatsApp/Telegram'ından manuel gönderir**
4. Kullanıcı "gönderildi" işaretler → `sent`, `lead_activity_log`'a kayıt düşer

### Akış F — Pipeline takibi
1. Dashboard: aktif lead sayısı, açık teklif sayısı, potansiyel komisyon toplamı, yüksek potansiyelli araçlar
2. Kanban görünümü: lead durumlarına göre sürükle-bırak

### Akış G — Pazar alarmı ve erken ilan bildirimi
1. Kullanıcı uygulamada `watchlists` filtresi oluşturur: kaynak, ülke/şehir, marka/model, yıl, km, fiyat ve anahtar kelimeler.
2. Sistem kullanıcı başına ayrı istek atmaz; her `market_sources` kaynağı merkezi taranır ve random jitter uygulanmış kaynak bazlı aralıklarla çalışır.
3. Yeni ilanlar `market_listings` tablosuna `source_key + source_listing_id` veya `source_key + listing_url` üzerinden tekilleştirilerek kaydedilir.
4. Kaydedilen ilanlar aktif kullanıcı watchlist'leriyle eşleştirilir; her eşleşme için `listing_alerts` kaydı oluşturulur.
5. Tek Telegram botu kullanılır. Kullanıcı Telegram kullanıcı adını kaydeder, botu başlatır, webhook kullanıcının `chat_id` değerini doğrular.
6. Bildirim sadece kullanıcının kendi Telegram chat'ine dahili alarm olarak gider. Bu akış müşteriyle otomatik iletişim değildir.

**Tarama politikası:** Resmi API/RSS/saved-search feed varsa 1-3 dakika aralığı mümkün olabilir. HTML scraping gereken kaynaklarda 10-20 dakika ve ±%30-40 jitter varsayılandır. Geniş sorgular daha seyrek, dar ve kritik sorgular daha sık çalışır; kullanıcı sayısı arttıkça marketplace'e giden istek sayısı lineer artmaz.

---

## 4. API / Servis Yapısı

Next.js App Router + Server Actions öneriyorum (ayrı bir REST API katmanına MVP'de gerek yok, ileride mobil app gerekirse route handler'lara taşınabilir).

```
app/
  (dashboard)/
    vehicles/            -> page.tsx, actions.ts
    leads/                -> page.tsx, actions.ts
    matches/              -> page.tsx, actions.ts
    offers/[id]/          -> page.tsx, actions.ts, pdf-preview.tsx
    compliance/[offerId]/ -> page.tsx, actions.ts
    messages/             -> page.tsx, actions.ts
    dashboard/            -> page.tsx (özet metrikler)

lib/
  services/
    vehicles.ts     -- CRUD + CSV import parse
    leads.ts        -- CRUD + basic scoring helper
    matching.ts     -- scoring algoritması (kural tabanlı, sonra AI destekli)
    offers.ts       -- maliyet hesaplama mantığı
    compliance.ts   -- checklist validasyonu
    pdf.ts          -- PDF üretim (ör. @react-pdf/renderer veya Puppeteer)
    messages.ts      -- taslak üretimi (şablon + opsiyonel AI), ASLA gönderim yapmaz
    market-alerts.ts -- merkezi ilan havuzu, watchlist eşleştirme, jitter'lı scanner kayıtları
    notifications.ts -- dahili Telegram alarm gönderimi ve chat_id doğrulama
    audit.ts        -- audit_log yazımı

  supabase/
    client.ts       -- browser client
    server.ts       -- server client (service role sadece server tarafında)

  validation/
    schemas.ts      -- zod şemaları (form + server action girişleri için)
```

**Kural:** `messages.ts` içinde **hiçbir dış API'ye (WhatsApp Business API, Telegram Bot API vb.) gönderim çağrısı olmayacak** — MVP'de bu servis sadece metin üretir/saklar. Bu, "insan onaylı" prensibini kod seviyesinde garanti eder.

---

## 5. Güvenlik ve Yetkilendirme

- **Supabase Auth**: email/parola veya magic link, tek kullanıcı/az kullanıcı senaryosu için yeterli.
- **Row Level Security (RLS)**: Her tabloda `created_by` / organizasyon bazlı filtre. MVP tek kullanıcıysa bile RLS'i baştan aç — ileride ekip büyürse migration derdi olmaz.
- **Roller**: `owner` (tam yetki), `broker` (CRUD, teklif oluşturma), `assistant` (sadece görüntüleme + veri girişi, teklif/mesaj onaylama yetkisi yok).
- **Hassas veri**: Lead telefon/WhatsApp gibi kişisel veriler → GDPR kapsamında saklama süresi ve amaç sınırlaması düşünülmeli (özellikle üçüncü ülkeye — İran'a — veri aktarımı yapılmıyor, veri AB sunucusunda kalıyor; bunu bilinçli bir tasarım kararı olarak dokümante et).
- **Dosya güvenliği**: Supabase Storage bucket'ları private, signed URL ile erişim (PDF ve görseller dışarıya açık link olarak paylaşılmamalı, süreli link üretilmeli).
- **Audit log**: Her teklif oluşturma/onaylama/mesaj onaylama işlemi loglanır — ileride "kim ne zaman ne onayladı" sorgusu için (özellikle compliance açısından önemli).
- **Sır yönetimi**: API anahtarları (varsa ileride AI/scraping entegrasyonları) `.env` + Supabase secrets, asla client tarafına sızdırılmaz.

---

## 6. MVP Yol Haritası (Fazlar)

**Faz 0 — Temel (1-2 hafta)**
- Supabase proje kurulumu, auth, şema migration
- Vehicles + Leads CRUD (manuel form)
- CSV import (araçlar için)
- Basit dashboard (liste görünümleri)

**Faz 1 — Eşleştirme + Teklif (2-3 hafta)**
- Kural tabanlı matching engine (filtre + skor)
- Offer calculator (tüm kalemler editable)
- PDF üretimi (Farsça şablon) + WhatsApp özet metni
- Compliance checklist zorunlu adım olarak entegre

**Faz 2 — CRM ve Onay Akışı (1-2 hafta)**
- Pipeline/kanban görünümü
- Message draft üretimi + manuel onay akışı
- Lead activity log, audit log
- Dashboard metrikleri (beklenen komisyon, aktif teklif sayısı vb.)

**Faz 3 — Verimlilik (opsiyonel, sonraki)**
- Toplu lead import (sosyal medya export dosyalarından)
- n8n ile hatırlatma otomasyonları (ör. "3 gündür temas edilmeyen lead" bildirimi)
- AI destekli seriousness scoring ve mesaj taslağı öneri kalitesi artırımı
- Scraping/API entegrasyonları (marketplace'lerden otomatik ilan çekme — burada her sitenin ToS'una dikkat)

---

## 7. Gelecekteki Otomasyon Olasılıkları

- **AI destekli eşleştirme**: Lead notları + araç açıklamalarını embedding ile karşılaştırıp kural tabanlı skora ek bir "semantik uyum" katmanı eklemek.
- **AI destekli mesaj taslağı**: Teklif detaylarından otomatik Farsça mesaj taslağı üretme (yine onay zorunlu).
- **Otomatik ilan toplama**: mobile.de, truckscout24 gibi sitelerden API/scraping ile ilan çekme (ToS kontrolü + rate limit'e dikkat).
- **Kur takibi entegrasyonu**: EUR/IRR güncel kur otomatik çekilip teklif hesaplamasına yansıtılabilir.
- **WhatsApp Business API entegrasyonu (ileride, tam onay ile)**: Şu an bilinçli olarak MVP dışı bırakıldı; ileride istenirse "gönder" butonuna insan tıklar, sistem API üzerinden gönderir — ama bu bile "gönder"den önce mutlaka önizleme + onay ekranı gerektirir.
- **Otomatik hatırlatmalar**: n8n ile "X gündür temas yok" gibi bildirimler (bunlar mesaj göndermez, sadece dahili uyarı üretir).

---

## 8. Riskler ve Teknik Zorluklar

| Risk | Açıklama | Azaltma |
|---|---|---|
| Yaptırım/uyumluluk riski | İran'a araç/parça ihracatı AB/ABD yaptırım rejimlerine tabi olabilir; bazı parça kategorileri (dual-use, askeri potansiyelli) yasak olabilir | Her teklif öncesi compliance checklist zorunlu; düzenli olarak ihracat hukuku danışmanından güncel liste al; sistem sadece "hatırlatıcı", nihai karar insan sorumluluğunda |
| Veri kalitesi | Manuel/CSV giriş hatalı/eksik veri riski taşır | Form validasyonu (zod), zorunlu alanlar, CSV import öncesi önizleme + hata raporu |
| Kur dalgalanması | EUR/IRR kuru teklif geçerlilik süresi içinde değişebilir | Teklife `validity_date` zaten eklendi; kur anlık değil, teklif anındaki kur donuk olarak kaydedilir |
| Yanlış otomatik mesaj gönderimi | AI/otomasyon yanlışlıkla gönderim yapabilir | Kod seviyesinde `messages.ts` dış API çağrısı içermez; mimari olarak imkansız kılınmış, sadece config/feature flag ile açılabilir bir yapı değil |
| Ölçeklenmeyen matching mantığı | Kural tabanlı skor, çok fazla araç/lead olduğunda kaba kalabilir | Faz 3'te embedding tabanlı arama düşünülebilir, ama MVP'de gerek yok |
| PDF/görsel depolama maliyeti | Çok sayıda araç görseli Storage maliyetini artırabilir | Görsel boyut/kalite optimizasyonu (upload sırasında resize), gerekirse eski/satılmış araç görsellerini arşivleme |
| Tek geliştirici bağımlılığı | Sen tek başına geliştiriyorsun, bakım yükü | Kod tabanını basit tutmak (aşırı mühendislikten kaçın), iyi dokümante edilmiş service layer |

---

## 9. Önerilen Klasör Yapısı

```
arac-ihracat-mvp/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── vehicles/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── actions.ts
│   │   ├── leads/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── actions.ts
│   │   ├── matches/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts
│   │   ├── offers/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── actions.ts
│   │   ├── compliance/
│   │   │   └── [offerId]/page.tsx
│   │   └── messages/
│   │       ├── page.tsx
│   │       └── actions.ts
│   └── api/
│       └── webhooks/ (Faz 3, gerekirse)
├── components/
│   ├── ui/                  -- shadcn/ui bileşenleri
│   ├── vehicles/
│   ├── leads/
│   ├── offers/
│   └── pdf/
├── lib/
│   ├── services/
│   ├── supabase/
│   ├── validation/
│   ├── pdf-templates/
│   └── utils/
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── public/
├── .env.local.example
├── package.json
└── README.md
```

---

## 10. Codex / Claude Code İçin İlk Uygulama Görevleri

Bunları sırasıyla, küçük commit'ler halinde ver:

1. **Proje iskeleti**: `create-next-app` (App Router, TypeScript, Tailwind) + Supabase client kurulumu (`lib/supabase/client.ts`, `server.ts`)
2. **Supabase migration**: Yukarıdaki şemayı `supabase/migrations/0001_init.sql` olarak yaz, RLS politikalarını ekle (basit: `created_by = auth.uid()` kuralı)
3. **Auth**: Login sayfası + middleware ile korumalı `(dashboard)` grubu
4. **Vehicles modülü**: Liste sayfası (tablo, filtre), yeni araç formu (zod validasyonlu server action), CSV import endpoint'i (parse + toplu insert + hata raporu)
5. **Leads modülü**: Aynı pattern — liste, form, CRUD server actions
6. **Matching engine v1**: Basit kural tabanlı fonksiyon (`lib/services/matching.ts`) — brand/model/year/mileage/price/vehicle_type/budget karşılaştırması, 0-100 skor
7. **Offer calculator**: Form + hesaplama fonksiyonu (`lib/services/offers.ts`), tüm kalemler editable input
8. **Compliance checklist UI**: Teklif detay sayfasında checkbox grubu, `all_clear` olmadan "PDF üret" butonu disabled
9. **PDF generator**: Farsça şablon (RTL destekli), `@react-pdf/renderer` veya Puppeteer + HTML şablon seçimi yapıp entegre et
10. **Dashboard metrikleri**: Aktif lead sayısı, açık teklif sayısı, beklenen komisyon toplamı (basit SQL aggregate query'ler)

Her görev için: önce migration/şema, sonra service fonksiyonu (test edilebilir, saf fonksiyon), sonra UI. Bu sıra, mantığı UI'dan bağımsız test etmeni kolaylaştırır.
