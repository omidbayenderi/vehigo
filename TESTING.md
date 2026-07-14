# Vehigo test rehberi

Vitest iş kurallarını ve veri dönüşümlerini hızlı şekilde doğrular. Testleri çalıştırmak için:

```bash
npm test
```

Yeni filtre, karar durumu veya fırsat skoru eklenirken ilgili mutlu yol, sınır değeri ve hata yolu birlikte test edilmelidir. Harici pazar ve Telegram çağrıları testlerde gerçek servislere gitmemeli; sabit fixture veya mock kullanılmalıdır.

## Production kanıt kapıları

Secret değerlerini okumadan migration sırası, environment sözleşmesi ve zorunlu runbook/workflow dosyalarını kontrol etmek için:

```bash
npm run evidence:baseline
```

Unit test, lint, tip kontrolü ve production build dahil yerel kapı:

```bash
npm run evidence:full
```

Yalnız staging projesine link verildiği doğrulandıktan sonra, uzak migration geçmişini de kontrol eden kapı:

```bash
npm run evidence:staging
```

Her çalışma `.artifacts/production-evidence-*.json` altında git tarafından izlenmeyen bir makbuz üretir. `evidence:staging` production projesine karşı çalıştırılmaz; önce `supabase projects list` ve linklenen project ref bağımsız olarak doğrulanmalıdır.

## Yerel Supabase

Repository `supabase/config.toml` ile CLI tarafından yeniden kurulabilir. Docker çalışırken:

```bash
npm run db:start
npm run db:reset
npm run db:status
```

`supabase/seed.sql` bilinçli olarak gerçek kullanıcı, kaynak izni, gümrük kuralı veya kur verisi üretmez. İki tenant'lı deterministik güvenlik fixture'ları `0026` izolasyon paketiyle birlikte eklenecektir.

İzole E2E projesinin migration capability durumunu yalnız metadata seçimiyle, satır veya secret yazdırmadan kontrol etmek için:

```bash
npm run db:verify:test-schema
```

E2E global setup `offers`, `leads` ve `vehicles` tablolarını temizlediği için `.env.test.local` içinde `E2E_ALLOW_DESTRUCTIVE_CLEANUP=true` yalnız projenin `.env.local` projesinden farklı ve atılabilir olduğu doğrulandıktan sonra ayarlanır. `npm run test:e2e` artık tarayıcıyı açmadan önce bu güvenlik kapısını ve şema capability kontrolünü çalıştırır.

`0022` migration'ı test kullanıcısından önce uygulanmışsa koşullu seed boş kalabilir. E2E preflight bu durumda yalnız disposable test projesinde `vehigo-default` organizasyonunu ve test kullanıcısı için aktif `broker` üyeliğini idempotent olarak hazırlar; var olan aktif rolü değiştirmez.

Operasyon acceptance scriptlerini ana proje değişkenlerine dokunmadan disposable E2E projesinde çalıştırmak için:

```bash
npm run acceptance:e2e:runtime
npm run acceptance:e2e:controls
npm run acceptance:e2e:maintenance
```

Bu komutlar `--e2e` olmadığı sürece mevcut canlı acceptance davranışını değiştirmez. E2E modu yalnız açık disposable-project izniyle çalışır ve test kayıtlarını kendi suffix/kimlikleriyle temizler.

Environment sözleşmesini değerleri yazdırmadan kontrol etmek için:

```bash
npm run env:check
npm run env:check:staging
npm run env:check:production
```
