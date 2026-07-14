import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { approveExportScenario } from "@/lib/services/export-scenarios";

const schema = z.object({ reason: z.string().trim().max(2000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await supabase.from("users_profile").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return NextResponse.json({ error: "İhracat senaryosunu yalnız owner onaylayabilir." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Geçersiz onay gerekçesi." }, { status: 400 });
  const { id } = await params;
  try { return NextResponse.json({ scenario: await approveExportScenario(supabase, id, user.id, parsed.data.reason) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Onay başarısız." }, { status: 400 }); }
}
