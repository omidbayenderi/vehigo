import { BellRing, ExternalLink, FileText, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listMarketSources, listRecentAlerts, listWatchlists, readConditionFilter, readSeatFilter } from "@/lib/services/market-alerts";
import { describeOpportunity, recommendLeadsForListing } from "@/lib/services/opportunity-flow";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";
import TelegramSettingsForm from "./telegram-settings-form";
import WatchlistForm from "./watchlist-form";
import WatchlistToggle from "./watchlist-toggle";
import WatchlistEditor from "./watchlist-editor";
import ManualTriggerButtons from "./manual-trigger-buttons";
import { startOfferFromAlertAction } from "./actions";
import OpportunityDecisionForm from "./opportunity-decision-form";

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: leads }, sources, watchlists, alerts] = await Promise.all([
    supabase.from("users_profile").select("*").eq("id", user.id).single(),
    supabase.from("leads").select("*").eq("created_by", user.id).order("seriousness_score", { ascending: false }),
    listMarketSources(supabase),
    listWatchlists(supabase, user.id),
    listRecentAlerts(supabase, user.id),
  ]);
  const activeLeads = (leads ?? []).filter((lead) => lead.status !== "closed_won" && lead.status !== "closed_lost");

  return (
    <div>
      <PageHeader
        eyebrow="Pazar izleme"
        title="İlan alarmları"
        description="Otomobilden ağır vasıtaya kadar aradığınız aracı Avrupa genelinde izleyin. Yeni eşleşmeler her gün sabah ve akşam 12 saatlik Telegram özetiyle gelir."
      />

      <div className="mb-6">
        <ManualTriggerButtons canRunScanner={profile?.role === "owner"} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <TelegramSettingsForm
          username={profile?.telegram_username ?? null}
          verified={Boolean(profile?.telegram_chat_id && profile.telegram_verified_at)}
        />
        <div className={`${cardClass} p-5`}>
          <h2 className="mb-3 text-sm font-medium text-ink">Kaynak tarama politikası</h2>
          <div className="space-y-2 text-sm text-ink-soft">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between gap-3">
                <span>{source.name}</span>
                <span className="text-right text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {source.method === "email_alert"
                    ? "Deep Search · ek bağlantı isteğe bağlı"
                    : `${source.min_interval_minutes} dk ± %${source.jitter_percent} · otomatik`}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Merkezi Scout agent Marktplaats ve Avrupa Deep Search ağını yaklaşık 8 saatte bir, jitter ile günde 3-4 kez tarar. Deep Search kaynakları e-posta olmadan keşfeder; korumalı sitelerde e-posta/API/n8n bağlantısı yalnız hız ve veri tamlığı için isteğe bağlı ek kanaldır. DB yalnız aranabilir ilan özeti ve kaynak linkini tutar.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <WatchlistForm sources={sources} />
      </div>

      <div className={`mb-6 ${cardClass}`}>
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="text-sm font-medium text-ink">Aktif filtreler</h2>
        </div>
        <div className="divide-y divide-line-soft">
          {watchlists.map((watchlist) => (
            <div
              key={watchlist.id}
              className="border-l-[3px] px-5 py-4 transition-colors hover:bg-surface-sunken"
              style={{ borderLeftColor: watchlist.active ? "#15803D" : "#D9D4C9" }}
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
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
                {readSeatFilter(watchlist) || readConditionFilter(watchlist) ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    {[readSeatFilter(watchlist) ? `${readSeatFilter(watchlist)} koltuk` : null, conditionFilterLabel(readConditionFilter(watchlist))]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className={pillClasses(watchlist.active ? "success" : "neutral")}>
                  {watchlist.active ? "Aktif" : "Pasif"}
                </span>
                <WatchlistToggle id={watchlist.id} active={watchlist.active} />
              </div>
              </div>
              <WatchlistEditor watchlist={watchlist} sources={sources} seatCount={readSeatFilter(watchlist)} condition={readConditionFilter(watchlist)} />
            </div>
          ))}
          {watchlists.length === 0 ? (
            <EmptyState icon={BellRing} title="Henüz alarm kuralı yok" description="Yukarıdan bir filtre oluşturarak ilan izlemeye başlayın." />
          ) : null}
        </div>
      </div>

      <div className={cardClass}>
        <div className="border-b border-line-soft px-5 py-4">
          <h2 className="text-sm font-medium text-ink">Fırsat akışı</h2>
          <p className="mt-1 text-xs text-ink-faint">
            En yüksek skorlu ilanlardan başlayın; uygun müşteri seçildiğinde teklif formu hazır açılır.
          </p>
        </div>
        <div className="divide-y divide-line-soft">
          {alerts.map((alert) => {
            const listing = alert.market_listings;
            if (!listing) return null;
            const decision = describeOpportunity(listing, alert.watchlists);
            const suggestions = recommendLeadsForListing(listing, activeLeads);
            const reasons = Array.isArray(alert.opportunity_reasons) ? alert.opportunity_reasons : [];
            const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ") || "İlan";
            const scoreTone = scorePillTone(alert.opportunity_score);

            return (
              <article key={alert.id} className="grid gap-4 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={pillClasses(scoreTone)}>
                      {labelText(alert.opportunity_label)} · {alert.opportunity_score ?? "-"}
                    </span>
                    {alert.alert_type === "price_drop" ? (
                      <span className={pillClasses("success")}>Fiyat düştü</span>
                    ) : null}
                    {listing.status === "delisted" ? (
                      <span className={pillClasses("danger")}>Satıldı / kaldırıldı</span>
                    ) : null}
                    <span className={pillClasses(statusTone(alert.status))}>{alert.status}</span>
                    <span className="text-xs text-ink-faint">
                      {new Date(alert.created_at).toLocaleString("tr-TR")}
                    </span>
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-ink">{title}</h3>
                      <p className="mt-1 text-sm text-ink-soft">
                        {[
                          listing.price !== null ? `${listing.price.toLocaleString("tr-TR")} ${listing.currency}` : "Fiyat yok",
                          listing.mileage_km !== null ? `${listing.mileage_km.toLocaleString("tr-TR")} km` : "Km yok",
                          listing.year ?? "Yıl yok",
                          [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "Konum yok",
                          listing.source_key,
                        ].join(" · ")}
                      </p>
                    </div>
                    <a
                      href={listing.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:border-brand hover:text-brand"
                      title="İlanı aç"
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                    </a>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-line-soft bg-paper p-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-ink">
                        <TrendingUp className="h-4 w-4 text-success" strokeWidth={1.75} />
                        {decision.marginText}
                      </div>
                      <p className="mt-2 text-xs text-ink-faint">
                        {reasons.slice(0, 3).map(String).join(" · ") || "Skor nedeni henüz yok"}
                      </p>
                    </div>
                    <div className="rounded-md border border-line-soft bg-paper p-3">
                      <span className={pillClasses(decision.riskTone)}>Risk notu</span>
                      <p className="mt-2 text-xs text-ink-faint">{decision.riskNotes.join(" · ")}</p>
                    </div>
                  </div>
                  <OpportunityDecisionForm
                    alertId={alert.id}
                    status={alert.decision_status}
                    reason={alert.decision_reason}
                  />
                </div>

                <div className="rounded-md border border-line-soft bg-paper p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                    <FileText className="h-4 w-4 text-brand" strokeWidth={1.75} />
                    Teklife başla
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((suggestion) => (
                      <form
                        key={suggestion.lead.id}
                        action={async () => {
                          "use server";
                          await startOfferFromAlertAction(alert.id, suggestion.lead.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-left text-sm transition-colors hover:border-brand hover:bg-white"
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-medium text-ink">{suggestion.lead.company_or_name}</span>
                            <span className={pillClasses(scorePillTone(suggestion.score))}>%{suggestion.score}</span>
                          </span>
                          <span className="mt-1 block text-xs text-ink-faint">
                            {suggestion.estimatedMargin !== null
                              ? `${suggestion.estimatedMargin.toLocaleString("tr-TR")} ${suggestion.lead.budget_currency} tahmini alan`
                              : suggestion.reasons[0] ?? "Bütçe bilgisi eksik"}
                          </span>
                        </button>
                      </form>
                    ))}
                    {suggestions.length === 0 ? (
                      <p className="rounded-md bg-surface px-3 py-2 text-xs text-ink-faint">
                        Bu ilan için aktif lead önerisi yok. Lead ekleyince burada hızlı teklif aksiyonu görünür.
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {alerts.length === 0 ? (
            <EmptyState icon={BellRing} title="Henüz eşleşen ilan yakalanmadı" description="Kaynaklar tarandıkça eşleşen ilanlar burada görünecek." />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function labelText(label: "hot" | "good" | "watch" | "low" | null) {
  if (label === "hot") return "HOT";
  if (label === "good") return "GOOD";
  if (label === "watch") return "WATCH";
  if (label === "low") return "LOW";
  return "INFO";
}

function scorePillTone(score: number | null): PillTone {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 55) return "warning";
  return "neutral";
}

function conditionFilterLabel(condition: ReturnType<typeof readConditionFilter>) {
  if (condition === "new") return "Sıfır";
  if (condition === "used_excellent") return "İkinci el - çok iyi";
  if (condition === "used_good") return "İkinci el - iyi";
  if (condition === "used_fair") return "İkinci el - normal";
  if (condition === "damaged") return "Kazalı / hasarlı";
  return null;
}

function statusTone(status: string): PillTone {
  if (status === "sent") return "success";
  if (status === "failed") return "danger";
  if (status === "skipped") return "warning";
  return "brand";
}
