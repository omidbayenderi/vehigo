import { timingSafeEqual } from "node:crypto";

export type ScannerCredential = "ingest" | "cron";

export function isScannerRequestAuthorized(request: Request, credentials: ScannerCredential[]) {
  return credentials.some((credential) => {
    if (credential === "ingest") {
      return safeEqual(request.headers.get("x-scanner-secret"), process.env.SCANNER_INGEST_SECRET);
    }
    const expected = process.env.CRON_SECRET;
    const actual = request.headers.get("authorization");
    return safeEqual(actual, expected ? `Bearer ${expected}` : undefined);
  });
}

function safeEqual(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
