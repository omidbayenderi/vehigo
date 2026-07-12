# Vehigo n8n workflows

Bu dizindeki workflow'lar Hostinger n8n üzerinde Vehigo'nun mevcut scanner API'lerini
zamanlamak için hazırlanmıştır. Workflow dosyalarında URL, token veya kullanıcı bilgisi
saklanmaz.

## Gerçek kabiliyet sınırı

- `scanner-run.json`, uygulamadaki mevcut scanner'ı tetikler. Bugün yalnızca
  `marktplaats` doğrudan site adaptörüyle, `brave_web` ise Brave arama indeksi üzerinden
  çalışır.
- Kaynak kataloğunda görünen diğer siteler bu workflow sayesinde kendiliğinden doğrudan
  taranmaz. Her biri için izinli API/RSS, kayıtlı arama e-postası veya ayrı ve test edilmiş
  n8n adaptörü gerekir.
- Facebook özel grupları veya oturum gerektiren korumalı siteler için insan taklidi yapan
  tarayıcı otomasyonu bu paket kapsamında değildir. Yalnızca yetkilendirilmiş ve sitenin
  kurallarına uygun bağlantılar kullanılmalıdır.
- `scanner-health.json`, korumalı `/api/scanner/health` endpoint'ini saatlik kontrol eder.
  Önce endpoint deploy edilmeli, ardından workflow test edilip etkinleştirilmelidir.

## Gerekli n8n ortam değişkenleri

Hostinger'da n8n container/service ortamına aşağıdaki değerleri tanımlayın:

```text
VEHIGO_APP_URL=https://uygulamaniz.example
VEHIGO_SCANNER_SECRET=uzun-rastgele-bir-deger
```

`VEHIGO_SCANNER_SECRET`, uygulamanın `SCANNER_INGEST_SECRET` değeriyle aynı olmalıdır.
Değeri workflow JSON dosyalarına yazmayın. n8n kurulumunuz expression içinde `$env`
erişimini kapatıyorsa aynı header'ı n8n Credentials içindeki bir Header Auth credential'ı
ile yönetin ve workflow'lardaki header ifadesini credential ile değiştirin.

Health workflow da diğer iki workflow gibi `x-scanner-secret` header'ını kullanır.

## Import ve aktivasyon

1. n8n arayüzünde **Workflows > Import from File** seçeneğini açın.
2. `scanner-run.json` ve `scanner-digest.json` dosyalarını içe aktarın.
3. Her workflow'daki HTTP Request düğümünü elle çalıştırın ve HTTP 200 ile `ok: true`
   döndüğünü doğrulayın.
4. Scan sonucunda Supabase `scanner_runs` kaydı oluştuğunu; test ilanında
   `market_listings` tekilleştirmesi, eşleşme ve Telegram akışını doğrulayın.
5. Workflow'ları aktif edin.
6. `scanner-health.json` dosyasını import edin, endpoint'in sağlıklı durumda HTTP 200
   döndürdüğünü doğrulayın ve ardından aktif edin.

Saatler workflow'larda UTC olarak tanımlıdır:

- Scanner: her gün `05:17`, `13:17`, `21:17` UTC
- Digest: her gün `09:31`, `21:31` UTC
- Health: her saatin `47`. dakikası

Bu zamanlar mevcut GitHub Actions zamanlamasıyla aynıdır. n8n aktive edildiğinde çift
çalışmayı önlemek için GitHub Actions `Scanner Cron` workflow'unu devre dışı bırakın.
Uygulama kaynakları atomik lease ile kilitler; yine de gereksiz istek ve maliyet
oluşturmamak için yalnız tek scheduler aktif tutulmalıdır.

## Üretim kontrol listesi

- TLS geçerli ve `VEHIGO_APP_URL` herkese açık HTTPS adresidir.
- Scanner secret en az 32 rastgele byte'tır ve yalnız uygulama/n8n ortamında bulunur.
- n8n execution pruning ve hata kayıt saklama süresi ayarlanmıştır.
- n8n sahibi için başarısız workflow bildirimleri etkinleştirilmiştir.
- Scanner ve digest test çalışmaları 200 döndürmüştür.
- GitHub scheduler kapatılmıştır.
- Her yeni kaynak, doğrudan canlı kabul edilmeden önce kaynak bazında test edilmiştir.

Bu workflow'larda HTTP düğümü hatalı yanıtta execution'ı başarısız yapar. n8n instance
seviyesinde bir Error Workflow tanımlanması önerilir. Telegram teslimatı uygulamada
kademeli retry kullanır; dış kaynak çağrılarını yine de agresif biçimde tekrarlamayın.
