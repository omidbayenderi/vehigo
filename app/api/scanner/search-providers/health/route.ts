import { isScannerRequestAuthorized } from "@/lib/scanner/request-auth";
import { checkFederatedSearchProviders } from "@/lib/scanner/search-providers/health";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isScannerRequestAuthorized(request, ["ingest"])) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const providers = await checkFederatedSearchProviders();
  const ok = providers.every((provider) => provider.ok);
  return Response.json(
    { ok, checked_at: new Date().toISOString(), providers },
    { status: ok ? 200 : 503 },
  );
}
