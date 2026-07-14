import type { SearchSort, SortDirection } from "@/lib/supabase/types";
import type { ListingMatchEvaluation, SearchListing } from "./matcher";

export type SearchResultItem = { listing: SearchListing; evaluation: ListingMatchEvaluation };
export type SearchResultCard = SearchResultItem & { alternatives: SearchResultItem[]; clusterKey: string };

export function groupDuplicateListings(items: SearchResultItem[]): SearchResultCard[] {
  const groups = new Map<string, SearchResultItem[]>();
  for (const item of items) {
    const clusterKey = item.listing.duplicate_cluster_id
      ?? item.listing.canonical_fingerprint
      ?? `listing:${item.listing.id}`;
    const group = groups.get(clusterKey) ?? [];
    group.push(item);
    groups.set(clusterKey, group);
  }

  return [...groups.entries()].map(([clusterKey, group]) => {
    const ordered = [...group].sort(comparePrimary);
    return { ...ordered[0], clusterKey, alternatives: ordered.slice(1) };
  });
}

export function sortSearchResultCards(
  cards: SearchResultCard[],
  sortBy: SearchSort = "relevance",
  direction: SortDirection = "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...cards].sort((left, right) => {
    const leftValue = sortValue(left, sortBy);
    const rightValue = sortValue(right, sortBy);
    if (leftValue === null && rightValue !== null) return 1;
    if (leftValue !== null && rightValue === null) return -1;
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) return (leftValue - rightValue) * multiplier;
    return left.listing.id.localeCompare(right.listing.id);
  });
}

function comparePrimary(left: SearchResultItem, right: SearchResultItem) {
  if (left.listing.status !== right.listing.status) return left.listing.status === "active" ? -1 : 1;
  if (left.evaluation.unknownFields.length !== right.evaluation.unknownFields.length) return left.evaluation.unknownFields.length - right.evaluation.unknownFields.length;
  if (left.evaluation.score !== right.evaluation.score) return right.evaluation.score - left.evaluation.score;
  const freshness = Date.parse(right.listing.last_seen_at) - Date.parse(left.listing.last_seen_at);
  return freshness || left.listing.id.localeCompare(right.listing.id);
}

function sortValue(card: SearchResultCard, sortBy: SearchSort) {
  if (sortBy === "relevance") return card.evaluation.score;
  if (sortBy === "newest") return Date.parse(card.listing.last_seen_at);
  if (sortBy === "price") return card.listing.price;
  if (sortBy === "mileage") return card.listing.mileage_km;
  return card.listing.year;
}
