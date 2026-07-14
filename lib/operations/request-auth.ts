import { timingSafeEqual } from "node:crypto";

export function isOperationsCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return safeEqual(request.headers.get("authorization"), secret ? `Bearer ${secret}` : undefined);
}

function safeEqual(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
