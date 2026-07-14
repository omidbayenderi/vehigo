import { createClient } from "@/lib/supabase/server";
import { searchWatchlistListings } from "@/lib/services/listing-search";
import { searchListingsRequestSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Oturum gerekli." }, { status: 401 });

  try {
    const url = new URL(request.url);
    const input = searchListingsRequestSchema.parse({
      watchlistId: url.searchParams.get("watchlistId"),
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDirection: url.searchParams.get("sortDirection") ?? undefined,
    });
    return Response.json(await searchWatchlistListings(supabase, { ...input, userId: user.id }));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Arama gerçekleştirilemedi." }, { status: 400 });
  }
}
