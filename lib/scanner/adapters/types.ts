import type { MarketListingInput } from "@/lib/domain/listings";
import type { Database, VehicleType } from "@/lib/supabase/types";

export type ScannerWatchlist = Database["public"]["Tables"]["watchlists"]["Row"];

export type ScanContext = {
  watchlists: ScannerWatchlist[];
};

export type ConnectorAcquisitionMode =
  | "official_api"
  | "partner_feed"
  | "permitted_html"
  | "saved_search_email"
  | "web_index"
  | "authorized_automation";

export type ConnectorField = keyof MarketListingInput;

export type ConnectorManifest = {
  key: string;
  version: string;
  displayName: string;
  countries: string[];
  acquisitionModes: ConnectorAcquisitionMode[];
  vehicleTypes: VehicleType[];
  fieldCoverage: ConnectorField[];
  supportsDirectSearch: boolean;
  supportsIncrementalSync: boolean;
};

export type ScanAdapter = {
  key: string;
  manifest: ConnectorManifest;
  fetchListings: (context: ScanContext) => Promise<MarketListingInput[]>;
};
