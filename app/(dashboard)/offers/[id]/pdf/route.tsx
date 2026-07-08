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
  };

  const buffer = await renderToBuffer(<OfferPdfDocument data={data} />);
  const storagePath = `${offer.id}.pdf`;

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
