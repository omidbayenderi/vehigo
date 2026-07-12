import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api/scanner/ingest|api/scanner/email-alert|api/scanner/run|api/scanner/digest|api/scanner/health|api/telegram/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
