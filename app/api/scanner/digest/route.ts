import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOpportunityDigest } from "@/lib/services/opportunity-digest";
import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";

export const maxDuration = 240;

export async function POST(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendDigest(request);
}

export async function GET(request: NextRequest) {
  if (!isScannerRequestAuthorized(request, ["cron"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendDigest(request);
}

async function sendDigest(request: NextRequest) {
  const hours = Number.parseInt(request.nextUrl.searchParams.get("hours") ?? "12", 10);
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10);
  const supabase = createAdminClient();
  const result = await sendOpportunityDigest(supabase, {
    hours: Number.isFinite(hours) ? hours : 12,
    limitPerUser: Number.isFinite(limit) ? limit : 5,
  });

  return Response.json({ ok: true, ...result });
}
