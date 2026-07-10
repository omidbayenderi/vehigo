import type { MarketListingInput } from "@/lib/services/market-alerts";
import type { Database } from "@/lib/supabase/types";

export type ScannerWatchlist = Database["public"]["Tables"]["watchlists"]["Row"];

export type ScanContext = {
  watchlists: ScannerWatchlist[];
};

export type ScanAdapter = {
  key: string;
  fetchListings: (context: ScanContext) => Promise<MarketListingInput[]>;
};
