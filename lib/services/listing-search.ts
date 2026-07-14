import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SearchSort, SortDirection } from "@/lib/supabase/types";
import { evaluateListingForWatchlist } from "@/lib/search/matcher";
import { groupDuplicateListings, sortSearchResultCards } from "@/lib/search/results";

type Client = SupabaseClient<Database>;
const MAX_SEARCH_CANDIDATES = 5000;

export async function searchWatchlistListings(
  supabase: Client,
  options: {
    watchlistId: string;
    userId: string;
    page?: number;
    pageSize?: number;
    sortBy?: SearchSort;
    sortDirection?: SortDirection;
  },
) {
  const { data: watchlist, error: watchlistError } = await supabase
    .from("watchlists")
    .select("*")
    .eq("id", options.watchlistId)
    .eq("user_id", options.userId)
    .single();
  if (watchlistError) throw new Error(watchlistError.message);

  const { data: listings, error: listingsError } = await supabase
    .from("market_listings")
    .select("*")
    .eq("status", "active")
    .order("last_seen_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(MAX_SEARCH_CANDIDATES + 1);
  if (listingsError) throw new Error(listingsError.message);

  const truncated = (listings?.length ?? 0) > MAX_SEARCH_CANDIDATES;
  const evaluated = (listings ?? []).slice(0, MAX_SEARCH_CANDIDATES).flatMap((listing) => {
    const evaluation = evaluateListingForWatchlist(listing, watchlist);
    return evaluation.matches ? [{ listing, evaluation }] : [];
  });
  const sortBy = options.sortBy ?? watchlist.sort_by ?? "relevance";
  const sortDirection = options.sortDirection ?? watchlist.sort_direction ?? "desc";
  const grouped = sortSearchResultCards(groupDuplicateListings(evaluated), sortBy, sortDirection);
  const pageSize = options.pageSize ?? watchlist.page_size ?? 25;
  const total = grouped.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(options.page ?? 1, totalPages);
  const offset = (page - 1) * pageSize;

  return {
    watchlistId: watchlist.id,
    searchMode: watchlist.search_mode ?? "discovery",
    sortBy,
    sortDirection,
    page,
    pageSize,
    total,
    totalPages,
    truncated,
    results: grouped.slice(offset, offset + pageSize),
  };
}
