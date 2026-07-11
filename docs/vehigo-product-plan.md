<!-- /autoplan restore point: .gstack/autoplan-restores/main-autoplan-restore-20260711.md -->
# Vehigo Ürün Dönüşüm Planı

## Onaylanmış ürün tezi

Vehigo’nun ana kullanıcısı Avrupa’dan küçük ve büyük araç bulup alım-satım veya ihracat yapan bağımsız tüccarlar ile küçük ve orta ölçekli galerilerdir. Ürün; ilan bulma, fiyat ve fırsat analizi, Telegram bildirimi, müşteri eşleştirme, teklif, maliyet-kâr takibi ve satış sürecini tek yerde yönetir. İlk pazar Avrupa geneli, ilk arayüz dili Türkçe ve temel değer önerisi “kârlı aracı rakiplerden önce bul ve satışa kadar yönet”dir.

## Kullanıcının günlük çekirdek döngüsü

1. Aradığı araç profilini birkaç dakikada kaydeder.
2. Vehigo Avrupa kaynaklarını sürekli izler ve yeni ilanları tekilleştirir.
3. Sabah ve akşam Telegram özeti en iyi yeni fırsatları nedenleriyle gösterir.
4. Kullanıcı ilanı inceler, karşılaştırır, favoriler veya eler.
5. Uygun müşteriyi eşleştirir; toplam maliyet, hedef satış fiyatı ve beklenen kârı görür.
6. Teklif ve iletişim taslağını hazırlar, takip görevlerini yönetir.
7. Sonuçlardan öğrenen sistem hangi filtre ve kaynakların işe yaradığını gösterir.

## Faz 1: Güvenilir fırsat motoru

- Otomobil, van, kamyon, otobüs, dorse ve iş makinesi için ortak veri modeli.
- Avrupa genelinde ülke, marka/model, yıl, kilometre, fiyat, yakıt, şanzıman ve özellik filtreleri.
- Kaynak kapsama ve sağlık ekranı; veri gelmeyen kaynaklar için açık uyarılar.
- İlan tekilleştirme, fiyat değişimi ve ilan kaldırılma takibi.
- Sabah/akşam Telegram özeti; yalnız yeni ve henüz gönderilmemiş ilanlar.
- Kullanıcı geri bildirimi: uygun, pahalı, yanlış araç, satılmış, ilgilenmiyorum.
- Fırsat skorunun açıklanabilir nedenleri ve eksik veri uyarıları.

## Faz 2: Ticari karar masası

- Favori/kısa liste ve yan yana araç karşılaştırması.
- Toplam edinme maliyeti: araç, KDV, taşıma, sigorta, gümrük, hazırlık ve komisyon.
- Hedef satış fiyatı, beklenen brüt/net kâr ve marj hesabı.
- Kaynak/ülke/model bazında fiyat karşılaştırması ve piyasa aralığı.
- Müşteri talepleriyle otomatik eşleştirme ve eşleşme açıklaması.
- Satın alma kontrol listesi: evrak, VIN, hasar, satıcı ve ödeme riski.

## Faz 3: Satış ve operasyon sistemi

- Teklif, mesaj taslağı, takip görevi ve satış aşamaları.
- Araç başına iletişim, belge, not ve karar geçmişi.
- Takım rolleri, sahiplik, aktivite kaydı ve hatırlatmalar.
- Kazanılan/kaybedilen işlem nedenleri; dönüşüm ve kârlılık raporları.
- Telegram üzerinden hızlı aksiyonlar ve kritik fiyat değişimi uyarıları.

## Faz 4: Kalıcı avantaj

- Kullanıcı davranışlarından kişiselleşen fırsat sıralaması.
- Satıcı güven skoru ve tekrar eden risk sinyalleri.
- Kaynak kapsama kalitesi ve eksik pazarların ölçümü.
- İşlem geçmişinden gerçek maliyet ve satış süresi tahmini.
- Veri dışa aktarma, entegrasyon API’leri ve denetlenebilir otomasyon.

## Başarı ölçütleri

- İlk değer zamanı: ilk kayıtlı aramadan ilk geçerli fırsata kadar geçen süre.
- Haftalık aktif arama kullanan tüccar oranı.
- Telegram özetinden ilana açılma ve kısa listeye eklenme oranı.
- Bildirilen ilanların doğruluk/uygunluk oranı.
- Fırsattan teklife, tekliften satışa dönüşüm.
- İşlem başına beklenen ve gerçekleşen kâr farkı.
- Kaynakların başarılı tarama oranı ve yeni ilan gecikmesi.

## İlk uygulama paketi

1. Önceki küçük/büyük araç ve iki günlük Telegram değişikliklerini tamamla.
2. Fırsat akışına karar durumları ekle: yeni, kısa listede, elendi, işlem başlatıldı.
3. Kullanıcının eleme nedenini kaydet; skor kalitesi için veri oluştur.
4. Dashboard’u “bugün ne yapmalıyım?” sırasına göre yeniden düzenle.
5. Scanner sağlık ve Telegram bağlantısını kullanıcıya anlaşılır hazır/değil durumu olarak göster.
6. Çekirdek akışlar için otomatik test altyapısı ve regresyon testleri ekle.

## Kapsam dışı ilk aşama

- Tüketiciye açık ilan pazaryeri.
- Otomatik araç satın alma veya satıcıya otomatik bağlayıcı teklif gönderme.
- Kredi, ödeme saklama veya emanet hesap işletme.
- Her Avrupa sitesini kuralları ihlal ederek doğrudan kazıma.
- İlk paket içinde mobil native uygulama.

## İnceleme kararları

- Çekirdek avantaj ilan sayısı değil, tüccarın kararlarını öğrenen fırsat motorudur.
- İlk paket mevcut servisleri yeniden yazmaz; watchlist, scanner, Telegram, lead, offer ve audit akışlarını birleştirir.
- Veri kaynağı sağlığı ve Telegram teslimatı ürün özelliğidir; sessiz başarısızlık kabul edilmez.
- Kullanıcıya gönderilen her ilan tekilleştirilmeli, karar durumu taşımalı ve ticari sonuca kadar izlenebilmelidir.
- Yeni marketplace’ler yalnız resmi API, izinli tarama, saved-search e-postası veya kontrollü ingest ile eklenmelidir.

## Sonraki uygulama sırası

1. Supabase migration’larını uygula ve üretim verisiyle karar akışını doğrula.
2. İlan fiyat geçmişi, satılmış/kaldırılmış tespiti ve fiyat düşüşü Telegram uyarısı ekle.
3. Kısa listedeki araçlar için yan yana karşılaştırma ve toplam edinme maliyeti ekranı ekle.
4. Gerçekleşen işlem kârı ile beklenen kârı kaydet; ülke, kaynak ve model bazında raporla.
5. Kullanıcı kararlarından kişiselleşen fırsat sıralamasını ölçümlü ve geri alınabilir biçimde devreye al.
6. Kaynak adaptörleri için sözleşme testleri, Telegram için entegrasyon testi ve çekirdek yol için E2E testi ekle.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` | Scope & strategy | 1 | CLEAR | Fırsat-motoru odağı seçildi; tüketici pazaryeri ve finansal saklama kapsam dışı |
| Codex Review | `/autoplan` | Independent 2nd opinion | 0 | NOT RUN | Yerel çift-model inceleme tamamlanmadı |
| Eng Review | `/autoplan` | Architecture & tests | 1 | CLEAR WITH FOLLOW-UPS | Migration sırası, kaynak sağlığı ve dış servis hata yolları izlenecek |
| Design Review | `/autoplan` | UI/UX gaps | 1 | CLEAR | Dashboard günlük aksiyon sırasına çevrildi; özel ekran tarayıcı QA hesabı bekliyor |
| DX Review | `/autoplan` | Developer experience gaps | 1 | CLEAR | Vitest, test komutları ve test rehberi eklendi |

- **UNRESOLVED:** Üretim migration uygulaması, gerçek hesapla özel ekran QA’sı ve Avrupa kaynak kapsamının genişletilmesi.
- **VERDICT:** İlk uygulama paketi kodlandı ve yerel doğrulamaları geçti; migration sonrası staging canary testi gerekli.
