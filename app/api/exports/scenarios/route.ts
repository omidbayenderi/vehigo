import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createExportScenario, listExportScenarios } from "@/lib/services/export-scenarios";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try { return NextResponse.json({ scenarios: await listExportScenarios(supabase) }); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try { return NextResponse.json({ scenario: await createExportScenario(supabase, await request.json(), user.id) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 400 }); }
}

function message(error: unknown) { return error instanceof Error ? error.message : "İhracat senaryosu işlemi başarısız."; }
