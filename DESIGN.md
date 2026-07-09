# Design System — Vehigo

## Product Context
- **What this is:** Dahili bir CRM/operasyon aracı — Avrupa'dan İran'a ağır vasıta ihracatı için araç, müşteri, teklif, uyumluluk ve pazar alarmı süreçlerini yönetir.
- **Kim için:** Küçük bir ekip (owner + birkaç broker/asistan), günlük yoğun kullanım.
- **Sektör/emsaller:** B2B fleet/lojistik SaaS + uyumluluk/trust odaklı araçlar (Vanta, Linear tarzı ciddiyet).
- **Proje tipi:** Veri yoğun internal dashboard/CRM.
- **Akılda kalması istenen tek şey:** "Bu ciddi, güvenilir bir kurumsal araç."

## Aesthetic Direction
- **Yön:** Endüstriyel hassasiyet + rafine restraint — "sessiz güven"
- **Dekorasyon seviyesi:** Kasıtlı (ince gölge/kenarlık derinliği, süs/illüstrasyon yok)
- **Mood:** Bir banka/hukuk bürosu ciddiyetinde ama günlük operasyon için sürtünmesiz.
- **Referanslar:** Linear (karanlık/minimal disiplin, restraint), Vanta (açık tema, "trust" odaklı sıcaklık).

## Typography
- **Başlık (Display):** Fraunces, 600/700 — sadece sayfa/bölüm başlıklarında, nadir ve kasıtlı kullanılır.
- **Gövde/UI/Tablo:** Geist (mevcut, next/font/google ile zaten yüklü) — rakamlarda `tabular-nums`.
- **Yükleme:** Fraunces `next/font/google` ile; Geist mevcut kurulum korunuyor.
- **Ölçek:** h1 28-32px/600, h2 20-22px/600, gövde 14-15px/400, meta/label 12-13px/500.

## Color
- **Yaklaşım:** Kısıtlı — tek marka rengi (lacivert-indigo), sıcak nötrler, semantik durum renkleri ayrı.
- **Marka/Aksiyon (brand):** `#2D3FE0` — birincil butonlar, aktif nav, odak durumları.
- **Marka hover/koyu (brand-ink):** `#1C2999`
- **Marka zemin (brand-wash):** `#ECEEFB` — aktif nav arka planı, hafif vurgu.
- **Mürekkep (ink):** `#17182B` — başlıklar, birincil veri değerleri.
- **İkincil metin (ink-soft):** `#4B4D61` — etiketler, ikincil başlıklar.
- **Soluk metin (ink-faint):** `#8B8B9E` — meta bilgi, placeholder.
- **Zemin (paper):** `#FAF9F7` — sayfa arka planı.
- **Yüzey (surface):** `#FFFFFF` — kart/form/input arka planı.
- **Çökük yüzey (surface-sunken):** `#F1EFE9` — hover, rozet/pill arka planı.
- **Çizgi (line):** `#D9D4C9` — input kenarlıkları.
- **Yumuşak çizgi (line-soft):** `#ECE8E0` — kart kenarlıkları, ayırıcılar.
- **Semantik:** success `#15803D`/wash `#E7F5EC`, warning `#B45309`/wash `#FBF0E2`, danger `#B91C1C`/wash `#FBE9E9`.
- **Dark mode:** Şu an kapsam dışı — uygulama tek (açık) temada çalışıyor.

## Spacing
- **Taban birim:** 4px (Tailwind varsayılanı korunuyor)
- **Yoğunluk:** Konforlu — yoğun tablo/formlarda okunabilirlik önceliği

## Layout
- **Yaklaşım:** Izgara disiplinli — veri yoğun tablo/formlar için öngörülebilirlik esas.
- **Border radius:** `rounded-md` (~8px) genel, `rounded-lg` (~10-12px) kartlar, `rounded-full` rozet/pill.

## Motion
- **Yaklaşım:** Minimal-fonksiyonel — sadece durum geçişlerinde (hover, disabled, onay anları) anlaşılırlığı artıran geçişler. Sayfa girişlerinde/scroll'da dekoratif animasyon yok.

## Kasıtlı Riskler (jenerik admin panelinden ayıran şeyler)
1. **Başlıklarda Fraunces (serif)** — B2B araçların neredeyse hiçbiri bunu yapmıyor; "özenle düşünülmüş" hissi verir, fonksiyonu bozmaz.
2. **Lacivert-indigo marka rengi** — jenerik mavi/siyah yerine hem görsel hem anlamsal "güven" çağrışımı.
3. **"Mühürlenmiş onay" kartı** — uyumluluk checklist'i tamamlandığında (`all_clear`), yeşil çerçeveli/rozetli belirgin bir "PDF üretilebilir" kartı — güvenin en kritik olduğu anı görsel olarak pekiştirir.

## Decisions Log
| Tarih | Karar | Gerekçe |
|---|---|---|
| 2026-07-09 | İlk tasarım sistemi oluşturuldu | `/design-consultation` ile — Linear/Vanta araştırması + kullanıcı onayı sonrası |
| 2026-07-10 | Uygulama geneline "ölçülü elevasyon" uygulandı: sidebar'da ikon + logo mührü + avatar, stat kartlarında ikon rozeti + hover derinliği, tablo satırlarında hover geçişi, durum çubukları (mini bar chart), arama inputlarında ikon, login'de amblem + ambient wash | Kullanıcı uygulamanın "hala beyaz sade" kaldığını belirtti; restraint ilkesi korunarak (dekoratif animasyon yok, tek marka rengi) derinlik/hiyerarşi eklendi — "Kasıtlı Riskler"e dördüncü madde olarak eklenmedi çünkü ilkeyi bozmuyor, sadece uyguluyor |
