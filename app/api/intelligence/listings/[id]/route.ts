import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeMarketListing, getLatestListingIntelligence } from "@/lib/services/market-intelligence";
import { runAiDamageReview, runAiMarketReview } from "@/lib/services/ai-evaluation-ledger";

const analyzeSchema = z.object({ includeAi: z.boolean().optional().default(false), evaluationType: z.enum(["market_review", "damage_review"]).optional().default("market_review") });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { id } = await params;
  try {
    const snapshot = await getLatestListingIntelligence(supabase, id);
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analiz okunamadı." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const parsed = analyzeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz analiz isteği." }, { status: 400 });
  const { id } = await params;
  try {
    const admin = createAdminClient();
    const snapshot = await analyzeMarketListing(admin, id);
    const evaluation = parsed.data.includeAi
      ? parsed.data.evaluationType === "damage_review"
        ? await runAiDamageReview(admin, user.id, snapshot)
        : await runAiMarketReview(admin, user.id, snapshot)
      : null;
    return NextResponse.json({ snapshot, evaluation }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analiz oluşturulamadı." }, { status: 500 });
  }
}
