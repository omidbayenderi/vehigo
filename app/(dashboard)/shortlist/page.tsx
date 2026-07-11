import { ExternalLink, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listShortlistedAlerts } from "@/lib/services/market-alerts";
import { getOrCreatePurchaseChecklist, calculateAcquisitionCost } from "@/lib/services/purchase-checklist";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses } from "@/lib/ui";
import PurchaseChecklist from "./purchase-checklist";

export default async function ShortlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const alerts = await listShortlistedAlerts(supabase, user.id);
  const rows = await Promise.all(
    alerts
      .filter((alert) => alert.market_listings)
      .map(async (alert) => {
        const listing = alert.market_listings!;
        const checklist = await getOrCreatePurchaseChecklist(supabase, listing.id);
        return { alert, listing, checklist };
      }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Ticari karar masası"
        title="Kısa liste karşılaştırması"
        description="Kısa listeye aldığınız ilanları yan yana karşılaştırın; satın almadan önce risk kontrolünü ve toplam edinme maliyetini kaydedin."
      />

      {rows.length > 0 ? (
        <div className={`mb-6 overflow-x-auto ${cardClass}`}>
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3">İlan</th>
                <th className="px-4 py-3">Yıl</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">İlan fiyatı</th>
                <th className="px-4 py-3">Toplam edinme maliyeti</th>
                <th className="px-4 py-3">Risk kontrolü</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map(({ listing, checklist }) => {
                const title = listing.title || [listing.brand, listing.model].filter(Boolean).join(" ") || "İlan";
                const total = calculateAcquisitionCost(listing.price, checklist);
                return (
                  <tr key={listing.id} className="hover:bg-surface-sunken">
                    <td className="px-4 py-3">
                      <a
                        href={listing.listing_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline"
                      >
                        {title}
                        <ExternalLink className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{listing.year ?? "-"}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {listing.mileage_km !== null ? listing.mileage_km.toLocaleString("tr-TR") : "-"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {listing.price !== null ? `${listing.price.toLocaleString("tr-TR")} ${listing.currency}` : "-"}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {total.toLocaleString("tr-TR")} {listing.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className={pillClasses(checklist.all_clear ? "success" : "warning")}>
                        {checklist.all_clear ? "Tamam" : "Eksik"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="space-y-4">
        {rows.map(({ alert, listing, checklist }) => {
          const title = listing.title || [listing.brand, listing.model, listing.year].filter(Boolean).join(" ") || "İlan";
          return (
            <div key={listing.id} className={`${cardClass} grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_360px]`}>
              <div>
                <h3 className="text-base font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {[
                    listing.price !== null ? `${listing.price.toLocaleString("tr-TR")} ${listing.currency}` : "Fiyat yok",
                    listing.mileage_km !== null ? `${listing.mileage_km.toLocaleString("tr-TR")} km` : "Km yok",
                    [listing.seller_city, listing.seller_country].filter(Boolean).join(", ") || "Konum yok",
                  ].join(" · ")}
                </p>
                <p className="mt-2 text-xs text-ink-faint">Filtre: {alert.watchlists?.name ?? "-"}</p>
              </div>
              <PurchaseChecklist
                listingId={listing.id}
                listingPrice={listing.price}
                currency={listing.currency}
                checklist={checklist}
              />
            </div>
          );
        })}
        {rows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Henüz kısa listede ilan yok"
            description="Fırsat akışında bir ilanı 'Kısa liste' olarak işaretlediğinizde burada karşılaştırma ve risk kontrolü için görünecek."
          />
        ) : null}
      </div>
    </div>
  );
}
