import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createScenarioFromLegacyOffer } from "@/lib/services/export-scenarios";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { id } = await params;
  try { return NextResponse.json({ scenario: await createScenarioFromLegacyOffer(supabase, id, user.id) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Teklif senaryoya dönüştürülemedi." }, { status: 400 }); }
}
