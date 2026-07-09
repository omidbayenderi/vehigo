import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listOffers } from "@/lib/services/offers";

const statusLabel: Record<string, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  expired: "Süresi Doldu",
};

export default async function OffersPage() {
  const supabase = await createClient();
  const offers = await listOffers(supabase);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-serif font-semibold text-ink">Teklifler</h1>
      <div className="overflow-hidden rounded-lg border border-line-soft bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase text-ink-faint">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Toplam</th>
              <th className="px-4 py-3">Komisyon</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {offers?.map((offer) => (
              <tr key={offer.id} className="hover:bg-paper">
                <td className="px-4 py-3">
                  <Link href={`/offers/${offer.id}`} prefetch={false} className="font-medium text-ink hover:underline">
                    {new Date(offer.created_at).toLocaleDateString("tr-TR")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {offer.final_customer_price?.toLocaleString("tr-TR")} {offer.currency}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {offer.commission_amount_calculated?.toLocaleString("tr-TR")} {offer.currency}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-surface-sunken px-2 py-1 text-xs text-ink-soft">
                    {statusLabel[offer.status] ?? offer.status}
                  </span>
                </td>
              </tr>
            ))}
            {offers?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                  Henüz teklif oluşturulmadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
