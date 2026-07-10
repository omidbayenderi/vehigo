import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOpportunityDigest } from "@/lib/services/opportunity-digest";

export async function POST(request: NextRequest) {
  const secret = process.env.SCANNER_INGEST_SECRET;
  if (!secret || request.headers.get("x-scanner-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendDigest(request);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sendDigest(request);
}

async function sendDigest(request: NextRequest) {
  const hours = Number.parseInt(request.nextUrl.searchParams.get("hours") ?? "24", 10);
  const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10);
  const supabase = createAdminClient();
  const result = await sendOpportunityDigest(supabase, {
    hours: Number.isFinite(hours) ? hours : 24,
    limitPerUser: Number.isFinite(limit) ? limit : 5,
  });

  return Response.json({ ok: true, ...result });
}
