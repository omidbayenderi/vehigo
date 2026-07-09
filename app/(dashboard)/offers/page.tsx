import Link from "next/link";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listOffers } from "@/lib/services/offers";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cardClass, pillClasses, type PillTone } from "@/lib/ui";

const statusLabel: Record<string, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  expired: "Süresi Doldu",
};

const statusTone: Record<string, PillTone> = {
  draft: "neutral",
  sent: "brand",
  accepted: "success",
  rejected: "danger",
  expired: "neutral",
};

export default async function OffersPage() {
  const supabase = await createClient();
  const offers = await listOffers(supabase);

  return (
    <div>
      <PageHeader eyebrow="Satış" title="Teklifler" description="Oluşturulan tüm teklifler ve durumları." />
      <div className={`overflow-hidden ${cardClass}`}>
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Toplam</th>
              <th className="px-4 py-3">Komisyon</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {offers?.map((offer) => (
              <tr key={offer.id} className="transition-colors hover:bg-surface-sunken">
                <td className="px-4 py-3">
                  <Link href={`/offers/${offer.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {new Date(offer.created_at).toLocaleDateString("tr-TR")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {offer.final_customer_price?.toLocaleString("tr-TR")} {offer.currency}
                </td>
                <td className="px-4 py-3 text-ink-soft" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {offer.commission_amount_calculated?.toLocaleString("tr-TR")} {offer.currency}
                </td>
                <td className="px-4 py-3">
                  <span className={pillClasses(statusTone[offer.status])}>
                    {statusLabel[offer.status] ?? offer.status}
                  </span>
                </td>
              </tr>
            ))}
            {offers?.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={FileText} title="Henüz teklif oluşturulmadı" description="Bir müşteri için araç eşleştirdikten sonra teklif oluşturabilirsiniz." />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
