import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getOffer, savePdfPath } from "@/lib/services/offers";
import { OfferPdfDocument, type OfferPdfData } from "@/lib/pdf-templates/offer-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const offer = await getOffer(supabase, id);
  if (!offer.compliance?.all_clear) {
    return NextResponse.json(
      { error: "Uyumluluk kontrol listesi tamamlanmadan PDF üretilemez" },
      { status: 400 },
    );
  }

  const data: OfferPdfData = {
    customerName: offer.lead?.company_or_name ?? "-",
    createdAt: new Date(offer.created_at).toLocaleDateString("fa-IR"),
    validityDate: offer.validity_date ? new Date(offer.validity_date).toLocaleDateString("fa-IR") : null,
    vehicleBrand: offer.vehicle?.brand ?? "-",
    vehicleModel: offer.vehicle?.model ?? "-",
    vehicleYear: offer.vehicle?.year ?? null,
    vehicleMileage: offer.vehicle?.mileage_km ?? null,
    vehicleCondition: offer.vehicle?.condition ?? null,
    currency: offer.currency,
    baseVehiclePrice: offer.base_vehicle_price,
    exportCompanyFee: offer.export_company_fee,
    transportCost: offer.transport_cost,
    insuranceCost: offer.insurance_cost,
    iranCustomsEstimate: offer.iran_customs_estimate,
    internalServiceFee: offer.internal_service_fee,
    commissionAmount: offer.commission_amount_calculated,
    finalCustomerPrice: offer.final_customer_price,
    deliveryTerms: offer.delivery_terms,
    paymentSteps: offer.payment_steps,
    landedCostSnapshot: readLandedCostSnapshot(offer.exportScenarioResult),
  };

  const buffer = await renderToBuffer(<OfferPdfDocument data={data} />);
  const storagePath = `${offer.organization_id}/${offer.id}.pdf`;

  await supabase.storage.from("offer-pdfs").upload(storagePath, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  await savePdfPath(supabase, offer.id, storagePath);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="teklif-${offer.id}.pdf"`,
    },
  });
}

function readLandedCostSnapshot(result: Awaited<ReturnType<typeof getOffer>>["exportScenarioResult"]): OfferPdfData["landedCostSnapshot"] {
  if (!result) return null;
  const input = result.input_snapshot && typeof result.input_snapshot === "object" && !Array.isArray(result.input_snapshot) ? result.input_snapshot : {};
  const totals = result.totals && typeof result.totals === "object" && !Array.isArray(result.totals) ? result.totals : {};
  const rules = result.rule_snapshot && typeof result.rule_snapshot === "object" && !Array.isArray(result.rule_snapshot) ? result.rule_snapshot : {};
  const fx = Array.isArray(result.exchange_rate_snapshot) ? result.exchange_rate_snapshot : [];
  return {
    evidenceHash: result.evidence_hash,
    calculationVersion: result.calculation_version,
    originCountryCode: typeof input.originCountryCode === "string" ? input.originCountryCode : "-",
    destinationCountryCode: typeof input.destinationCountryCode === "string" ? input.destinationCountryCode : "-",
    landedCost: typeof totals.landedCost === "number" ? totals.landedCost : 0,
    currency: typeof totals.currency === "string" ? totals.currency : "EUR",
    ruleSet: typeof rules.code === "string" ? `${rules.code} v${typeof rules.version === "number" ? rules.version : "?"}` : "-",
    exchangeRates: fx.flatMap((item) => item && typeof item === "object" && !Array.isArray(item) && typeof item.baseCurrency === "string" && typeof item.quoteCurrency === "string" && typeof item.rate === "number" ? [`${item.baseCurrency}/${item.quoteCurrency} ${item.rate}`] : []),
  };
}
