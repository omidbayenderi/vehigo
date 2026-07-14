# Vehigo operations and recovery runbook

Bu runbook, üretim operasyon kontrol düzleminin bakım, olay müdahalesi ve geri dönüş prosedürüdür. Her adım organizasyon sınırında ve audit kaydıyla yürütülür.

## Scheduled maintenance

`.github/workflows/operations-maintenance.yml`, `CRON_SECRET` ile korunan `/api/operations/maintenance` endpoint’ini her 5 dakikada bir çağırır. Yerel veya alternatif güvenli scheduler ortamında aynı bakım `npm run operations:maintenance` komutuyla çalıştırılabilir. Bakım:

- süresi dolmuş worker lease’lerini retry veya dead-letter durumuna taşır;
- retention süresi dolan olay ve sağlayıcı gözlemlerini siler;
- tamamlanmış işlerin süresi dolan payload/result alanlarını temizler;
- gecikmiş kurtarma tatbikatları için operasyon uyarısı açar.

Service-role anahtarını tarayıcıya, loglara veya scheduler komut satırına yazmayın; yalnızca secret store/environment üzerinden sağlayın. Başarısız bakım çalışması scheduler tarafından retry edilmeli ve ardışık üç hata ayrıca sayfalanmalıdır.

## Incident response

1. `/operations` ekranında açık kritik uyarıyı üstlenin.
2. Correlation ID ile iş, deneme, olay ve sağlayıcı gözlemlerini eşleştirin.
3. Sağlayıcı arızasında ilgili connector’ı durdurun veya rate-limit’i düşürün; veri kaybı yaratacak manuel tablo değişikliği yapmayın.
4. Dead-letter işi yalnızca kök neden giderildikten sonra replay edin. Replay yeni deneme bütçesi açar ve audit kaydı üretir.
5. İyileşme sonrası SLO penceresinin normale döndüğünü ve uyarının resolved olduğunu doğrulayın.

## Backup restore drill

Üretim ortamında otomatik yedekleme/PITR özelliğinin gerçekten etkin olduğunu sağlayıcı panelinden doğrulayın; Vehigo bu ayarı varsaymaz. En az üç ayda bir:

1. `/operations` üzerinden `backup_restore` tatbikatı planlayın ve başlatın.
2. İzole bir hedef projeye en son güvenli restore point’ten geri yükleyin.
3. Migration sürümlerini, organizasyon üyeliğini, kritik tablo satır sayılarını ve örnek correlation zincirini doğrulayın.
4. RTO/RPO, restore başlangıç-bitiş zamanı, kontrol sonuçları ve kanıt bağlantılarını JSON evidence olarak kaydedin.
5. Tatbikatı `passed` veya `failed` olarak kapatın. Failed sonucu kritik operasyon uyarısı üretir.

## Recovery acceptance criteria

- Başka organizasyonun işi, uyarısı veya metriği görünmez.
- Süresi dolmuş lease aynı anda iki worker tarafından sahiplenilmez.
- Aynı idempotency anahtarı ikinci yan etki üretmez.
- Replay yalnızca dead-letter durumunda ve owner tarafından yapılır.
- Restore sonrası audit kayıtları ve correlation zinciri okunabilir.
- Kanıtsız tatbikat tamamlanamaz.

## Rollback boundary

Migration’lar geriye doğru dosya silerek alınmaz. Hatalı bir değişiklik için yeni, ileri yönlü migration hazırlayın. Veri restore kararı owner, olay sorumlusu ve veri etkisi analizi olmadan verilmez.
