import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processIncomingListings, recordScannerRun } from "@/lib/services/market-alerts";
import type { MarketListingInput } from "@/lib/services/market-alerts";

type IngestPayload = {
  source_key: string;
  listings: MarketListingInput[];
};

export async function POST(request: NextRequest) {
  const secret = process.env.SCANNER_INGEST_SECRET;
  if (!secret || request.headers.get("x-scanner-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const payload = (await request.json()) as IngestPayload;
  if (!payload.source_key || !Array.isArray(payload.listings)) {
    return Response.json({ error: "source_key ve listings gerekli" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const result = await processIncomingListings(
      supabase,
      payload.listings.map((listing) => ({ ...listing, source_key: payload.source_key })),
    );
    const { nextRunAt } = await recordScannerRun(supabase, payload.source_key, startedAt, {
      status: "ok",
      result,
    });

    return Response.json({ ok: true, ...result, next_run_at: nextRunAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    await recordScannerRun(supabase, payload.source_key, startedAt, {
      status: "failed",
      error: message,
      fetchedCount: payload.listings.length,
    });

    return Response.json({ error: message }, { status: 500 });
  }
}
