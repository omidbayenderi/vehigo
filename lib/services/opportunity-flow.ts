import type { Database, VehicleType } from "@/lib/supabase/types";

type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];
type Lead = Database["public"]["Tables"]["leads"]["Row"];
type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];

export type LeadSuggestion = {
  lead: Lead;
  score: number;
  estimatedMargin: number | null;
  reasons: string[];
};

export type OpportunityDecision = {
  marginText: string;
  riskTone: "success" | "warning" | "danger" | "neutral";
  riskNotes: string[];
};

export function describeOpportunity(listing: Listing, watchlist: Watchlist | null): OpportunityDecision {
  const notes: string[] = [];
  const targetPrice = watchlist?.target_price ?? watchlist?.max_price ?? null;
  let marginText = "Marj için müşteri bütçesi seçin";

  if (listing.price !== null && targetPrice !== null) {
    const spread = targetPrice - listing.price;
    marginText =
      spread >= 0
        ? `Hedefe göre ${spread.toLocaleString("tr-TR")} ${listing.currency} boşluk`
        : `Hedefin ${Math.abs(spread).toLocaleString("tr-TR")} ${listing.currency} üzerinde`;
  } else if (listing.price === null) {
    notes.push("Fiyat eksik, manuel doğrulama gerekli");
  }

  if (listing.source_key === "brave_web") notes.push("Genel web sonucu, ilan sayfası kontrol edilmeli");
  if (!listing.price) notes.push("Fiyat parse edilemedi");
  if (!listing.year) notes.push("Yıl bilgisi eksik");
  if (!listing.mileage_km) notes.push("Km bilgisi eksik");

  const riskyWords = ["damaged", "accident", "defect", "parts only", "schade", "hasarlı"];
  const searchText = listingText(listing);
  const riskyHits = riskyWords.filter((word) => searchText.includes(word));
  if (riskyHits.length > 0) notes.push(`Riskli kelime: ${riskyHits.join(", ")}`);

  const riskTone =
    notes.some((note) => note.startsWith("Riskli kelime"))
      ? "danger"
      : notes.length >= 3
        ? "warning"
        : notes.length > 0
          ? "neutral"
          : "success";

  return {
    marginText,
    riskTone,
    riskNotes: notes.length > 0 ? notes.slice(0, 3) : ["Temel bilgiler yeterli görünüyor"],
  };
}

export function recommendLeadsForListing(listing: Listing, leads: Lead[], limit = 3): LeadSuggestion[] {
  return leads
    .map((lead) => scoreLeadForListing(lead, listing))
    .filter((suggestion) => suggestion.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function scoreLeadForListing(lead: Lead, listing: Listing): LeadSuggestion {
  const reasons: string[] = [];
  let score = Math.min(20, Math.max(0, lead.seriousness_score / 5));

  const listingType = listing.vehicle_type ?? inferVehicleType(listingText(listing));
  if (lead.desired_vehicle_type && listingType) {
    if (lead.desired_vehicle_type === listingType) {
      score += 32;
      reasons.push(`Araç tipi uyuyor: ${listingType}`);
    } else {
      score -= 20;
      reasons.push(`Araç tipi farklı: ${listingType}`);
    }
  }

  let estimatedMargin: number | null = null;
  if (listing.price !== null && lead.budget_max !== null) {
    estimatedMargin = lead.budget_max - listing.price;
    if (estimatedMargin >= 0) {
      score += estimatedMargin > listing.price * 0.08 ? 30 : 18;
      reasons.push(`Bütçede ${estimatedMargin.toLocaleString("tr-TR")} ${lead.budget_currency} alan var`);
    } else {
      score -= 25;
      reasons.push(`Bütçeyi ${Math.abs(estimatedMargin).toLocaleString("tr-TR")} ${lead.budget_currency} aşıyor`);
    }
  }

  if (listing.price !== null && lead.budget_min !== null && listing.price >= lead.budget_min) {
    score += 8;
    reasons.push("Bütçe alt sınırının üstünde");
  }

  if (lead.status === "new" || lead.status === "contacted" || lead.status === "interested") {
    score += 8;
    reasons.push(`Lead aktif: ${lead.status}`);
  }

  return {
    lead,
    score: Math.max(0, Math.min(100, Math.round(score))),
    estimatedMargin,
    reasons: reasons.slice(0, 3),
  };
}

export function marketListingToVehicleInsert(listing: Listing, userId: string): VehicleInsert {
  const label = listing.title ?? "";
  return {
    created_by: userId,
    source_site: listing.source_key,
    listing_url: listing.listing_url,
    seller_name: listing.seller_name,
    seller_country: listing.seller_country,
    brand: listing.brand ?? inferBrand(label) ?? "Bilinmeyen",
    model: listing.model ?? inferModel(label, listing.brand) ?? "İlan",
    year: listing.year,
    mileage_km: listing.mileage_km,
    price: listing.price,
    currency: listing.currency,
    vehicle_type: listing.vehicle_type ?? inferVehicleType(listingText(listing)) ?? "truck",
    availability_status: "available",
    condition: "used_good",
    notes: [
      listing.title ? `Kaynak başlık: ${listing.title}` : null,
      `Market listing id: ${listing.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function listingText(listing: Listing) {
  const raw = listing.raw;
  const rawText =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? [raw.description, raw.subject].filter((value) => typeof value === "string").join(" ")
      : "";

  return [listing.title, listing.brand, listing.model, listing.seller_city, listing.seller_country, rawText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function inferVehicleType(text: string): VehicleType | null {
  if (["trailer", "semi trailer", "auflieger", "remorque", "dorse"].some((term) => text.includes(term))) return "trailer";
  if (["excavator", "wheel loader", "construction machine", "baumaschine", "iş makinesi"].some((term) => text.includes(term))) return "construction";
  if (["spare parts", "truck parts", "ersatzteile", "yedek parça"].some((term) => text.includes(term))) return "spare_part";
  if (["bus", "coach", "reisebus", "otobüs"].some((term) => text.includes(term))) return "bus";
  if (["truck", "lorry", "vrachtwagen", "camion", "lastwagen", "tractor unit", "kamyon"].some((term) => text.includes(term))) return "truck";
  return null;
}

function inferBrand(title: string) {
  const brands = ["Mercedes-Benz", "Mercedes", "MAN", "DAF", "Volvo", "Scania", "Iveco", "Renault", "Ford"];
  const lower = title.toLowerCase();
  return brands.find((brand) => lower.includes(brand.toLowerCase())) ?? null;
}

export function inferModel(title: string, brand: string | null) {
  if (!title) return null;
  const cleaned = brand ? title.replace(new RegExp(brand, "i"), "") : title;
  return cleaned.split(/[,|-]/)[0]?.trim().split(/\s+/).slice(0, 3).join(" ") || null;
}
