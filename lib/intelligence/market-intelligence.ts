export const MARKET_INTELLIGENCE_VERSION = "market-v1";

export type ComparableListing = {
  id: string;
  sourceKey: string;
  duplicateClusterId?: string | null;
  canonicalFingerprint?: string | null;
  price: number | null;
  currency: string;
  brand: string | null;
  model: string | null;
  variant?: string | null;
  year: number | null;
  mileageKm: number | null;
  countryCode?: string | null;
  vehicleType?: string | null;
  bodyType?: string | null;
  fuelType?: string | null;
  transmission?: string | null;
  status?: string;
};

export type PriceDistribution = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  iqr: number;
};

export type MarketComparison = {
  selected: Array<ComparableListing & { similarity: number }>;
  distribution: PriceDistribution | null;
  sampleQuality: "insufficient" | "low" | "medium" | "high";
  claimEligible: boolean;
  comparableCount: number;
  sourceCount: number;
  underpricingPercent: number | null;
  confidence: number;
  excluded: Record<string, number>;
};

export function analyzeComparables(subject: ComparableListing, candidates: ComparableListing[]): MarketComparison {
  const excluded: Record<string, number> = {};
  const unique = new Map<string, ComparableListing & { similarity: number }>();

  for (const candidate of candidates) {
    const reason = hardExclusion(subject, candidate);
    if (reason) {
      excluded[reason] = (excluded[reason] ?? 0) + 1;
      continue;
    }
    const similarity = comparableSimilarity(subject, candidate);
    if (similarity < 0.55) {
      excluded.low_similarity = (excluded.low_similarity ?? 0) + 1;
      continue;
    }
    const identity = candidate.duplicateClusterId || candidate.canonicalFingerprint || candidate.id;
    const previous = unique.get(identity);
    if (!previous || similarity > previous.similarity) unique.set(identity, { ...candidate, similarity });
    else excluded.duplicate = (excluded.duplicate ?? 0) + 1;
  }

  const selected = [...unique.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 30);
  const prices = selected.map((item) => item.price).filter((price): price is number => typeof price === "number");
  const distribution = priceDistribution(prices);
  const sourceCount = new Set(selected.map((item) => item.sourceKey)).size;
  const sampleQuality = qualityFor(prices.length, sourceCount, average(selected.map((item) => item.similarity)));
  const claimEligible = (sampleQuality === "medium" || sampleQuality === "high") && sourceCount >= 2;
  const underpricingPercent = claimEligible && distribution && subject.price
    ? round(((distribution.median - subject.price) / distribution.median) * 100, 2)
    : null;
  const confidence = round(Math.min(0.95, prices.length / 14 * 0.55 + Math.min(sourceCount, 3) / 3 * 0.2 + average(selected.map((item) => item.similarity)) * 0.25), 3);

  return { selected, distribution, sampleQuality, claimEligible, comparableCount: prices.length, sourceCount, underpricingPercent, confidence, excluded };
}

export function priceDistribution(values: number[]): PriceDistribution | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  return {
    min: sorted[0],
    q1: round(q1, 2),
    median: round(percentile(sorted, 0.5), 2),
    q3: round(q3, 2),
    max: sorted[sorted.length - 1],
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length, 2),
    iqr: round(q3 - q1, 2),
  };
}

function hardExclusion(subject: ComparableListing, candidate: ComparableListing) {
  if (candidate.id === subject.id) return "subject";
  if (candidate.status && candidate.status !== "active") return "inactive";
  if (!candidate.price || candidate.price <= 0) return "missing_price";
  if (candidate.currency !== subject.currency) return "currency";
  if (normalized(candidate.brand) !== normalized(subject.brand) || normalized(candidate.model) !== normalized(subject.model)) return "taxonomy";
  if (subject.duplicateClusterId && candidate.duplicateClusterId === subject.duplicateClusterId) return "same_vehicle";
  if (subject.canonicalFingerprint && candidate.canonicalFingerprint === subject.canonicalFingerprint) return "same_vehicle";
  if (subject.year && candidate.year && Math.abs(subject.year - candidate.year) > 5) return "year";
  return null;
}

function comparableSimilarity(subject: ComparableListing, candidate: ComparableListing) {
  let score = 0.55;
  if (subject.year && candidate.year) score += Math.max(0, 0.14 - Math.abs(subject.year - candidate.year) * 0.035);
  if (subject.mileageKm !== null && candidate.mileageKm !== null) {
    const scale = Math.max(50_000, subject.mileageKm * 0.7);
    score += Math.max(0, 0.12 - Math.abs(subject.mileageKm - candidate.mileageKm) / scale * 0.12);
  }
  if (same(subject.vehicleType, candidate.vehicleType)) score += 0.05;
  if (same(subject.bodyType, candidate.bodyType)) score += 0.04;
  if (same(subject.fuelType, candidate.fuelType)) score += 0.04;
  if (same(subject.transmission, candidate.transmission)) score += 0.03;
  if (same(subject.variant, candidate.variant)) score += 0.02;
  if (same(subject.countryCode, candidate.countryCode)) score += 0.01;
  return round(Math.min(score, 1), 3);
}

function qualityFor(count: number, sources: number, similarity: number): MarketComparison["sampleQuality"] {
  if (count < 3) return "insufficient";
  if (count < 6 || sources < 2 || similarity < 0.64) return "low";
  if (count < 12 || sources < 3 || similarity < 0.74) return "medium";
  return "high";
}

function percentile(sorted: number[], percentileValue: number) {
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function same(a?: string | null, b?: string | null) {
  return Boolean(a && b && normalized(a) === normalized(b));
}

function normalized(value?: string | null) {
  return value?.trim().toLocaleLowerCase("tr-TR") ?? "";
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
