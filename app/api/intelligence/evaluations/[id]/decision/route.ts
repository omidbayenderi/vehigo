import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordAiHumanDecision } from "@/lib/services/ai-evaluation-ledger";

const decisionSchema = z.object({
  decision: z.enum(["accepted", "rejected", "needs_review"]),
  reason: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz insan kararı." }, { status: 400 });
  const { id } = await params;
  try {
    const evaluation = await recordAiHumanDecision(supabase, id, user.id, parsed.data.decision, parsed.data.reason);
    return NextResponse.json({ evaluation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Karar kaydedilemedi." }, { status: 500 });
  }
}
