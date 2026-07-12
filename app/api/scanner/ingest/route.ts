import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processIncomingListings, recordScannerRun } from "@/lib/services/market-alerts";
import { findSourceUrlMismatch, ingestPayloadSchema } from "@/lib/scanner/ingest-validation";

export async function POST(request: NextRequest) {
  const secret = process.env.SCANNER_INGEST_SECRET;
  if (!secret || request.headers.get("x-scanner-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Geçerli bir JSON gövdesi gerekli" }, { status: 400 });
  }

  const parsed = ingestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Geçersiz ingest payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const supabase = createAdminClient();
  const { data: source, error: sourceError } = await supabase
    .from("market_sources")
    .select("key, base_url, enabled")
    .eq("key", payload.source_key)
    .maybeSingle();

  if (sourceError) {
    return Response.json({ error: "Kaynak doğrulanamadı" }, { status: 500 });
  }
  if (!source) {
    return Response.json({ error: "Bilinmeyen arama kaynağı" }, { status: 404 });
  }
  if (!source.enabled) {
    return Response.json({ error: "Arama kaynağı aktif değil" }, { status: 409 });
  }

  const mismatchIndex = findSourceUrlMismatch(payload.listings, source);
  if (mismatchIndex !== null) {
    return Response.json(
      { error: "İlan URL alan adı arama kaynağıyla eşleşmiyor", listing_index: mismatchIndex },
      { status: 400 },
    );
  }

  const startedAt = new Date();

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
