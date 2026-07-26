# Telegram kanal ilan ayrıntıları — debug raporu

- **Belirti:** `Vehigo_Kriter` ve `Vehigo_Firsat` kanallarına ilanlar yerine yalnız sonuç sayısı ve “ayrıntılar özel mesajda” metni gidiyordu.
- **Kök neden:** `58fc002` commit'i transient kanal dağıtımında `formatTransientDigest(...)` çağrılarını toplu `formatPrivateChannelSignal(...)` mesajlarıyla değiştirmişti. Telegram bağlantısı ve kanal ortam ayarları çalışıyordu.
- **Düzeltme:** Kriter kanalına tüm eşleşmeler, Fırsat kanalına en az 65 puanlı eşleşmeler ve Arbitraj kanalına 1,5× onaylı eşleşmeler yeniden tam transient özet ve orijinal bağlantıyla gönderiliyor. Özel bot teslimatı korunuyor.
- **Regresyon testi:** `tests/transient-opportunity.test.ts` içindeki kanal testi artık Kriter ve Fırsat mesajlarında başlık, fiyat ve orijinal bağlantıyı doğruluyor.
- **İlgili:** İlan içerikleri transient kalır; Supabase'e kalıcı ilan kaydı yazılmaz. Tekrar teslimat kontrolü yalnız HMAC teslimat iziyle yapılır.
- **Durum:** DONE
