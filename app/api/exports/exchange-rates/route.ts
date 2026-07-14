import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createExchangeRateSnapshot } from "@/lib/services/export-scenarios";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await supabase.from("exchange_rate_snapshots").select("*").order("observed_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ rates: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try { return NextResponse.json({ rate: await createExchangeRateSnapshot(supabase, await request.json(), user.id) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Kur snapshot'ı kaydedilemedi." }, { status: 400 }); }
}
