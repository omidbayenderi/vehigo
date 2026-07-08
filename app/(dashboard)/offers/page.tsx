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
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900">Teklifler</h1>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Toplam</th>
              <th className="px-4 py-3">Komisyon</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {offers?.map((offer) => (
              <tr key={offer.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/offers/${offer.id}`} className="font-medium text-zinc-900 hover:underline">
                    {new Date(offer.created_at).toLocaleDateString("tr-TR")}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {offer.final_customer_price?.toLocaleString("tr-TR")} {offer.currency}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {offer.commission_amount_calculated?.toLocaleString("tr-TR")} {offer.currency}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                    {statusLabel[offer.status] ?? offer.status}
                  </span>
                </td>
              </tr>
            ))}
            {offers?.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
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
