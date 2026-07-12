import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOffer } from "@/lib/services/offers";
import { PageHeader } from "@/components/ui/page-header";
import { cardClass } from "@/lib/ui";
import EditCostForm from "./edit-cost-form";
import ComplianceChecklist from "../compliance-checklist";
import ConfirmSentButton from "./confirm-sent-button";
import CloseOutcomeForm from "./close-outcome-form";

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
      <PageHeader
        eyebrow="Teklif"
        title={`Teklif — ${offer.lead?.company_or_name ?? "?"}`}
        description={`Araç: ${offer.vehicle?.brand} ${offer.vehicle?.model} (${offer.vehicle?.year ?? "?"}) · Durum: ${offer.status}`}
        actions={
          <>
            <ConfirmSentButton offerId={offer.id} disabled={!offer.pdf_storage_path || offer.status !== "draft"} />
            {offer.compliance.all_clear ? (
              <Link
                href={`/offers/${offer.id}/pdf`}
                target="_blank"
                prefetch={false}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-ink"
              >
                PDF üret
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Tüm uyumluluk kutuları işaretlenmeden PDF üretilemez"
                className="cursor-not-allowed rounded-md bg-line px-4 py-2 text-sm font-medium text-white"
              >
                PDF üret
              </button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <EditCostForm offer={offer} />
        <ComplianceChecklist offerId={offer.id} compliance={offer.compliance} />
        <CloseOutcomeForm offer={offer} />
        {offer.compliance.all_clear ? (
          <Link
            href={`/messages/new?lead_id=${offer.lead_id}&offer_id=${offer.id}`}
            prefetch={false}
            className={`block ${cardClass} p-4 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-sunken`}
          >
            Mesaj taslağı oluştur →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
