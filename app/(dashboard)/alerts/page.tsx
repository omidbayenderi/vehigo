import { Activity, BellRing, ChevronRight, ExternalLink, FileText, TrendingUp } from "lucide-react";
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
import MarketIntelligenceCard from "./market-intelligence-card";
import { listLatestIntelligenceByListingIds } from "@/lib/services/market-intelligence";
import { AlertCheckbox, SelectionProvider, SelectionToolbar } from "./opportunity-flow-selection";
import type { MarketSourceVehicleCategory } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScannerActivitySummary } from "@/lib/services/scanner-health";

const sourceCategoryOrder: MarketSourceVehicleCategory[] = [
  "car_light_commercial",
  "heavy_commercial",
  "construction_agri",
  "general",
];

function sourceCategoryLabel(category: MarketSourceVehicleCategory) {
  if (category === "car_light_commercial") return "Binek & Hafif Ticari";
  if (category === "heavy_commercial") return "Ağır Ticari (TIR / Kamyon)";
  if (category === "construction_agri") return "İş Makineleri & Tarım";
  return "Genel";
}

export const maxDuration = 240;

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: leads }, sources, watchlists, alerts, scannerActivity] = await Promise.all([
    supabase.from("users_profile").select("*").eq("id", user.id).single(),
    supabase.from("leads").select("*").eq("created_by", user.id).order("seriousness_score", { ascending: false }),
    listMarketSources(supabase),
    listWatchlists(supabase, user.id),
    listRecentAlerts(supabase, user.id),
    getScannerActivitySummary(createAdminClient()),
  ]);
  const activeLeads = (leads ?? []).filter((lead) => lead.status !== "closed_won" && lead.status !== "closed_lost");
  const intelligenceByListingId = await listLatestIntelligenceByListingIds(
    supabase,
    [...new Set(alerts.map((alert) => alert.listing_id))],
  );
  const alertGroups = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    const listing = alert.market_listings;
    const clusterKey = listing?.duplicate_cluster_id ?? listing?.canonical_fingerprint ?? listing?.id ?? alert.id;
    const group = alertGroups.get(clusterKey) ?? [];
    group.push(alert);
    alertGroups.set(clusterKey, group);
  }
  const groupedAlerts = [...alertGroups.values()].map((group) => ({ alert: group[0], alternatives: group.slice(1) }));

  return (
    <div>
      <PageHeader
        eyebrow="Pazar izleme"
        title="İlan alarmları"
        description="Otomobilden ağır vasıtaya kadar aradığınız aracı Avrupa genelinde izleyin. Yeni eşleşmeler her gün sabah ve akşam 12 saatlik Telegram özetiyle gelir."
      />

      <div className={`mb-6 ${cardClass}`}>
        <ManualTriggerButtons canRunScanner={profile?.role === "owner"} />
        <TelegramSettingsForm
          username={profile?.telegram_username ?? null}
          verified={Boolean(profile?.telegram_chat_id && profile.telegram_verified_at)}
        />
      </div>

      <section className={`mb-6 ${cardClass}`} aria-label="Tarama durumu">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand/10 text-brand"><Activity size={18} aria-hidden="true" /></span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Otomatik tarama durumu</h2>
              <p className="mt-1 text-sm text-ink-faint">
                {scannerActivity.lastCompletedAt
                  ? `Son tur ${new Date(scannerActivity.lastCompletedAt).toLocaleString("tr-TR")}: ${scannerActivity.fetched} sonuç incelendi, ${scannerActivity.alertsCreated} yeni eşleşme bulundu.`
                  : "Henüz tamamlanmış bir otomatik tarama kaydı yok."}
              </p>
              {scannerActivity.nextRunAt ? <p className="mt-1 text-xs text-ink-faint">Planlanan sonraki tur: {new Date(scannerActivity.nextRunAt).toLocaleString("tr-TR")}</p> : null}
            </div>
          </div>
          <span className={pillClasses(scannerActivity.status === "active" ? "success" : scannerActivity.status === "failing" ? "danger" : "warning")}>
            {scannerActivity.status === "active" ? "Tarama aktif" : scannerActivity.status === "failing" ? `Sorun · ${scannerActivity.errorCode ?? "bilinmiyor"}` : "Tarama bekliyor"}
          </span>
        </div>
      </section>

      <details className={`group mb-6 ${cardClass}`}>
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-ink marker:content-none">
          <span className="inline-flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-ink-faint transition-transform group-open:rotate-90" strokeWidth={1.75} />
            Kaynak tarama politikası
          </span>
        </summary>
        <div className="border-t border-line-soft px-5 py-4">
          <div className="space-y-5">
            {sourceCategoryOrder.map((category) => {
              const categorySources = sources.filter((source) => (source.vehicle_category ?? "general") === category);
              if (categorySources.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    {sourceCategoryLabel(category)}
                  </h3>
                  <div className="space-y-2 text-sm text-ink-soft">
                    {categorySources.map((source) => (
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
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            Merkezi Europe Web Scout yaklaşık 160 dakikada bir, günde en fazla 9 tur çalışır. Mevcut alarm planında bu hız 50’den fazla site ve tüm araç kategorilerinin sorgu kuyruğunu günde en az bir kez tamamlar. Korumalı sitelerde e-posta veya izinli API bağlantısı yalnız hız ve veri tamlığı için ek kanaldır; ilan içeriği transient akışta kalıcı kaydedilmez.
          </p>
        </div>
      </details>

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
                  {[watchlist.brand, watchlist.model, watchlist.region_preset?.toUpperCase(), ...(watchlist.country_codes ?? []), watchlist.country, watchlist.city]
                    .filter(Boolean)
                    .join(" / ") || "Geniş filtre"}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Kaynaklar: {watchlist.source_keys.length > 0 ? watchlist.source_keys.join(", ") : "tümü"}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  Mod: {watchlist.search_mode === "strict" ? "Strict" : "Discovery"} · Tazelik: {watchlist.freshness_hours ?? 168} saat
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

      <details open className={`group ${cardClass}`}>
        <summary className="cursor-pointer list-none px-5 py-4 marker:content-none">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
            <ChevronRight className="h-4 w-4 text-ink-faint transition-transform group-open:rotate-90" strokeWidth={1.75} />
            Fırsat akışı
          </span>
          <p className="mt-1 pl-6 text-xs text-ink-faint">
            En yüksek skorlu ilanlardan başlayın; uygun müşteri seçildiğinde teklif formu hazır açılır.
          </p>
        </summary>
        <SelectionProvider>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-soft px-5 py-4">
          <SelectionToolbar allIds={groupedAlerts.map(({ alert }) => alert.id)} />
        </div>
        <div className="divide-y divide-line-soft">
          {groupedAlerts.map(({ alert, alternatives }) => {
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
                    <AlertCheckbox alertId={alert.id} />
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
                  {alert.commercial_status && alert.commercial_status !== "not_evaluated" ? (
                    <div className={`mt-4 rounded-md border p-3 ${alert.commercial_status === "approved" ? "border-success/30 bg-success/5" : "border-line-soft bg-paper"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={pillClasses(alert.commercial_status === "approved" ? "success" : alert.commercial_status === "error" ? "danger" : "warning")}>
                          {alert.commercial_status === "approved" ? "Ticari eşik onaylandı" : alert.commercial_status === "insufficient_data" ? "Piyasa kanıtı yetersiz" : alert.commercial_status === "error" ? "Değerlendirme hatası" : "Ticari eşik karşılanmadı"}
                        </span>
                        <span className="text-xs text-ink-faint">{alert.commercial_comparable_count ?? 0} karşılaştırma</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <div><span className="block text-xs text-ink-faint">Toplam maliyet</span><strong>{alert.estimated_total_cost?.toLocaleString("tr-TR") ?? "-"} {listing.currency}</strong></div>
                        <div><span className="block text-xs text-ink-faint">Muhafazakâr satış</span><strong>{alert.expected_sale_price?.toLocaleString("tr-TR") ?? "-"} {listing.currency}</strong></div>
                        <div><span className="block text-xs text-ink-faint">Net kâr / marj</span><strong>{alert.estimated_net_profit?.toLocaleString("tr-TR") ?? "-"} {listing.currency} · %{alert.estimated_net_margin_percent?.toFixed(1) ?? "-"}</strong></div>
                      </div>
                    </div>
                  ) : null}
                  <MarketIntelligenceCard listingId={listing.id} snapshot={intelligenceByListingId.get(listing.id)} />
                  <OpportunityDecisionForm
                    alertId={alert.id}
                    status={alert.decision_status}
                    reason={alert.decision_reason}
                  />
                  {alternatives.length > 0 ? (
                    <div className="mt-4 rounded-md border border-line-soft bg-surface-sunken/50 p-3">
                      <p className="text-xs font-medium text-ink">Aynı araca ait {alternatives.length} alternatif kaynak</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {alternatives.map((alternative) => alternative.market_listings ? (
                          <a key={alternative.id} href={alternative.market_listings.listing_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-brand hover:border-brand">
                            {alternative.market_listings.source_key}
                            {alternative.market_listings.price !== null ? ` · ${alternative.market_listings.price.toLocaleString("tr-TR")} ${alternative.market_listings.currency}` : ""}
                            <ExternalLink size={13} aria-hidden="true" />
                          </a>
                        ) : null)}
                      </div>
                    </div>
                  ) : null}
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
          {groupedAlerts.length === 0 ? (
            <EmptyState icon={BellRing} title="Henüz eşleşen ilan yakalanmadı" description="Kaynaklar tarandıkça eşleşen ilanlar burada görünecek." />
          ) : null}
        </div>
        </SelectionProvider>
      </details>
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
