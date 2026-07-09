import type { MarketListingInput } from "../../../lib/services/market-alerts";

export type ScanAdapter = {
  key: string;
  fetchListings: () => Promise<MarketListingInput[]>;
};
