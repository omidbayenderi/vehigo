export const MAX_SCANNER_REQUEST_BYTES = 1_000_000;

export class ScannerRequestBodyError extends Error {
  constructor(
    public readonly code: "body_too_large" | "invalid_json" | "empty_body",
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readBoundedJson(request: Request, maxBytes = MAX_SCANNER_REQUEST_BYTES) {
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ScannerRequestBodyError("body_too_large", 413, "İstek gövdesi boyut sınırını aşıyor");
  }

  const text = await request.text();
  if (!text.trim()) throw new ScannerRequestBodyError("empty_body", 400, "JSON gövdesi gerekli");
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new ScannerRequestBodyError("body_too_large", 413, "İstek gövdesi boyut sınırını aşıyor");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ScannerRequestBodyError("invalid_json", 400, "Geçerli bir JSON gövdesi gerekli");
  }
}
