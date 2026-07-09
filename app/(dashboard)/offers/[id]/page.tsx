import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOffer } from "@/lib/services/offers";
import EditCostForm from "./edit-cost-form";
import ComplianceChecklist from "../compliance-checklist";
import ConfirmSentButton from "./confirm-sent-button";

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let offer;
  try {
    offer = await getOffer(supabase, id);
  } catch {
    notFound();
  }
  if (!offer || !offer.compliance) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Teklif — {offer.lead?.company_or_name ?? "?"}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">Durum: {offer.status}</p>
        </div>
        <div className="flex items-center gap-2">
          <ConfirmSentButton offerId={offer.id} disabled={!offer.pdf_storage_path || offer.status !== "draft"} />
          {offer.compliance.all_clear ? (
            <Link
              href={`/offers/${offer.id}/pdf`}
              target="_blank"
              prefetch={false}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              PDF üret
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Tüm uyumluluk kutuları işaretlenmeden PDF üretilemez"
              className="cursor-not-allowed rounded-md bg-zinc-300 px-4 py-2 text-sm font-medium text-white"
            >
              PDF üret
            </button>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-zinc-500">
        Araç: {offer.vehicle?.brand} {offer.vehicle?.model} ({offer.vehicle?.year ?? "?"})
      </p>

      <div className="space-y-6">
        <EditCostForm offer={offer} />
        <ComplianceChecklist offerId={offer.id} compliance={offer.compliance} />
        {offer.compliance.all_clear ? (
          <Link
            href={`/messages/new?lead_id=${offer.lead_id}&offer_id=${offer.id}`}
            prefetch={false}
            className="block rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Mesaj taslağı oluştur →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
