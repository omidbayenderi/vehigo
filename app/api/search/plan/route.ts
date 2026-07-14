import { createClient } from "@/lib/supabase/server";
import { parseNaturalLanguageSearch } from "@/lib/search/search-plan";
import { searchPlanRequestSchema } from "@/lib/validation/schemas";

const MAX_PLAN_BODY_BYTES = 16_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum gerekli." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PLAN_BODY_BYTES) return Response.json({ error: "Arama planı isteği çok büyük." }, { status: 413 });

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PLAN_BODY_BYTES) {
      return Response.json({ error: "Arama planı isteği çok büyük." }, { status: 413 });
    }
    const input = searchPlanRequestSchema.parse(JSON.parse(raw));
    return Response.json({ plan: parseNaturalLanguageSearch(input.query) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Arama planı oluşturulamadı." }, { status: 400 });
  }
}
