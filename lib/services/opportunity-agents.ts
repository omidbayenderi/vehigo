import type { Database, Json } from "@/lib/supabase/types";

type Listing = Database["public"]["Tables"]["market_listings"]["Row"];
type Watchlist = Database["public"]["Tables"]["watchlists"]["Row"];

export type OpportunityAssessment = {
  score: number;
  label: "hot" | "good" | "watch" | "low";
  reasons: string[];
};

export function assessOpportunity(listing: Listing, watchlist: Watchlist): OpportunityAssessment {
  const reasons: string[] = [];
  let score = 35;

  const titleText = [listing.title, listing.brand, listing.model, listing.seller_city, listing.seller_country]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (watchlist.brand && textIncludes(listing.brand, watchlist.brand, titleText)) {
    score += 14;
    reasons.push(`Marka uyumu: ${watchlist.brand}`);
  }

  if (watchlist.model && textIncludes(listing.model, watchlist.model, titleText)) {
    score += 16;
    reasons.push(`Model uyumu: ${watchlist.model}`);
  }

  if (watchlist.country && textIncludes(listing.seller_country, watchlist.country, titleText)) {
    score += 8;
    reasons.push(`Ülke uyumu: ${watchlist.country}`);
  }

  if (watchlist.city && textIncludes(listing.seller_city, watchlist.city, titleText)) {
    score += 6;
    reasons.push(`Şehir uyumu: ${watchlist.city}`);
  }

  if (watchlist.vehicle_type && listing.vehicle_type === watchlist.vehicle_type) {
    score += 8;
    reasons.push(`Araç tipi uyumu: ${watchlist.vehicle_type}`);
  }

  if (watchlist.min_year !== null && listing.year !== null && listing.year >= watchlist.min_year) {
    score += 8;
    reasons.push(`Yıl beklentiyi karşılıyor: ${listing.year}`);
  }

  if (watchlist.max_mileage_km !== null && listing.mileage_km !== null && listing.mileage_km <= watchlist.max_mileage_km) {
    score += 8;
    reasons.push(`Km beklentiyi karşılıyor: ${listing.mileage_km.toLocaleString("tr-TR")} km`);
  }

  const targetPrice = watchlist.target_price ?? watchlist.max_price;
  if (targetPrice !== null && listing.price !== null) {
    if (listing.price <= targetPrice * 0.9) {
      score += 18;
      reasons.push(`Fiyat hedefin %10+ altında: ${listing.price.toLocaleString("tr-TR")} ${listing.currency}`);
    } else if (listing.price <= targetPrice) {
      score += 12;
      reasons.push(`Fiyat hedef içinde: ${listing.price.toLocaleString("tr-TR")} ${listing.currency}`);
    } else if (listing.price <= targetPrice * 1.08) {
      score += 4;
      reasons.push("Fiyat hedefe yakın");
    } else {
      score -= 12;
      reasons.push("Fiyat hedefin üzerinde");
    }
  }

  const matchedKeywords = watchlist.keywords.filter((keyword) => titleText.includes(keyword.toLowerCase()));
  if (matchedKeywords.length > 0) {
    score += Math.min(12, matchedKeywords.length * 4);
    reasons.push(`Keyword uyumu: ${matchedKeywords.join(", ")}`);
  }

  const missingMustHave = watchlist.must_have_keywords.filter(
    (keyword) => !titleText.includes(keyword.toLowerCase()),
  );
  if (missingMustHave.length > 0) {
    score -= 25;
    reasons.push(`Eksik kritik kelime: ${missingMustHave.join(", ")}`);
  }

  const excludedHits = watchlist.excluded_keywords.filter((keyword) => titleText.includes(keyword.toLowerCase()));
  if (excludedHits.length > 0) {
    score -= 35;
    reasons.push(`Hariç tutulan kelime var: ${excludedHits.join(", ")}`);
  }

  const firstSeenAgeHours = (Date.now() - new Date(listing.first_seen_at).getTime()) / 3_600_000;
  if (firstSeenAgeHours <= 24) {
    score += 8;
    reasons.push("Yeni yakalandı");
  }

  if (listing.source_key === "brave_web") {
    score -= 4;
    reasons.push("Genel web araması sonucu, manuel kontrol önerilir");
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: normalized,
    label: labelForScore(normalized),
    reasons: reasons.slice(0, 6),
  };
}

export function opportunityReasonsToJson(reasons: string[]): Json {
  return reasons;
}

function textIncludes(value: string | null, expected: string, fallback: string) {
  const needle = expected.toLowerCase();
  return value?.toLowerCase().includes(needle) || fallback.includes(needle);
}

function labelForScore(score: number): OpportunityAssessment["label"] {
  if (score >= 82) return "hot";
  if (score >= 68) return "good";
  if (score >= 50) return "watch";
  return "low";
}
