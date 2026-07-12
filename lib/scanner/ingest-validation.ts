import { z } from "zod";
import { marketListingInputSchema } from "@/lib/validation/schemas";

export const MAX_INGEST_BATCH_SIZE = 100;

const ingestListingSchema = marketListingInputSchema
  .omit({ source_key: true })
  .extend({ source_key: z.string().min(1).optional() });

export const ingestPayloadSchema = z
  .object({
    source_key: z.string().trim().min(1),
    listings: z.array(ingestListingSchema).min(1).max(MAX_INGEST_BATCH_SIZE),
  })
  .strict()
  .superRefine((payload, context) => {
    payload.listings.forEach((listing, index) => {
      if (listing.source_key && listing.source_key !== payload.source_key) {
        context.addIssue({
          code: "custom",
          path: ["listings", index, "source_key"],
          message: "İlan source_key değeri payload source_key ile eşleşmeli",
        });
      }
    });
  });

type SourceIdentity = {
  key: string;
  base_url: string | null;
};

/**
 * Most source ingests may only submit their own host (including subdomains).
 * `brave_web` is the documented aggregator exception: its purpose is to store
 * result URLs from third-party marketplace hosts. Public social catalogue keys
 * are limited to the canonical and legacy hosts listed below.
 */
export function listingUrlMatchesSource(listingUrl: string, source: SourceIdentity): boolean {
  const listingHost = normalizedHostname(listingUrl);
  if (!listingHost) return false;

  if (source.key === "brave_web") return true;
  if (source.key === "facebook_public") return hostMatches(listingHost, "facebook.com");
  if (source.key === "telegram_public") {
    return hostMatches(listingHost, "t.me") || hostMatches(listingHost, "telegram.me");
  }

  const sourceHost = source.base_url ? normalizedHostname(source.base_url) : null;
  return Boolean(sourceHost && hostMatches(listingHost, sourceHost));
}

export function findSourceUrlMismatch(
  listings: Array<{ listing_url: string }>,
  source: SourceIdentity,
): number | null {
  const index = listings.findIndex((listing) => !listingUrlMatchesSource(listing.listing_url, source));
  return index === -1 ? null : index;
}

function normalizedHostname(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return null;
  }
}

function hostMatches(actual: string, expected: string): boolean {
  return actual === expected || actual.endsWith(`.${expected}`);
}
