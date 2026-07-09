import { createClient } from "@/lib/supabase/server";
import { listMarketSources, listRecentAlerts, listWatchlists } from "@/lib/services/market-alerts";
import TelegramSettingsForm from "./telegram-settings-form";
import WatchlistForm from "./watchlist-form";
import WatchlistToggle from "./watchlist-toggle";

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, sources, watchlists, alerts] = await Promise.all([
    supabase.from("users_profile").select("*").eq("id", user.id).single(),
    listMarketSources(supabase),
    listWatchlists(supabase, user.id),
    listRecentAlerts(supabase, user.id),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-semibold text-ink">İlan alarmları</h1>
        <p className="mt-2 text-sm text-ink-faint">
          Pazar taraması merkezi çalışır: her kaynak bir kez taranır, ilanlar veritabanına alınır, sonra
          kullanıcı filtreleriyle eşleşen sonuçlar Telegram üzerinden bildirilir.
        </p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <TelegramSettingsForm
          username={profile?.telegram_username ?? null}
          verified={Boolean(profile?.telegram_chat_id && profile.telegram_verified_at)}
        />
        <div className="rounded-lg border border-line-soft bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-ink">Kaynak tarama politikası</h2>
          <div className="space-y-2 text-sm text-ink-soft">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between">
                <span>{source.name}</span>
                <span>
                  {source.min_interval_minutes} dk ± %{source.jitter_percent}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Bu aralıklar site bazlıdır; kullanıcı sayısı arttıkça aynı kaynak için istek sayısı artmaz.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <WatchlistForm sources={sources} />
      </div>

      <div className="mb-6 rounded-lg border border-line-soft bg-white">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="text-sm font-medium text-ink">Aktif filtreler</h2>
        </div>
        <div className="divide-y divide-line-soft">
          {watchlists.map((watchlist) => (
            <div key={watchlist.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-medium text-ink">{watchlist.name}</p>
                <p className="mt-1 text-sm text-ink-faint">
                  {[watchlist.brand, watchlist.model, watchlist.country, watchlist.city]
                    .filter(Boolean)
                    .join(" / ") || "Geniş filtre"}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Kaynaklar: {watchlist.source_keys.length > 0 ? watchlist.source_keys.join(", ") : "tümü"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    watchlist.active ? "bg-success-wash text-success" : "bg-surface-sunken text-ink-soft"
                  }`}
                >
                  {watchlist.active ? "Aktif" : "Pasif"}
                </span>
                <WatchlistToggle id={watchlist.id} active={watchlist.active} />
              </div>
            </div>
          ))}
          {watchlists.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-faint">Henüz alarm kuralı yok.</div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line-soft bg-white">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="text-sm font-medium text-ink">Son yakalanan ilanlar</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">İlan</th>
              <th className="px-4 py-3">Fiyat</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {alerts.map((alert) => {
              const listing = alert.market_listings;
              return (
                <tr key={alert.id} className="hover:bg-paper">
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(alert.created_at).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-3">
                    {listing ? (
                      <a
                        href={listing.listing_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-ink hover:underline"
                      >
                        {listing.title || `${listing.brand ?? ""} ${listing.model ?? ""}`.trim() || "İlan"}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {listing?.price?.toLocaleString("tr-TR") ?? "-"} {listing?.currency ?? ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-surface-sunken px-2 py-1 text-xs text-ink-soft">
                      {alert.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                  Henüz eşleşen ilan yakalanmadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
