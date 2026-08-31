export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

export async function readJsonObject(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  if (request.method !== "POST") {
    throw new HttpError(405, "method_not_allowed");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, "payload_too_large");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "payload_too_large");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_json_object");
  }
  return value as Record<string, unknown>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(error.status, { error: error.code });
  }

  console.error("request_failed", {
    type: error instanceof Error ? error.name : "unknown",
  });
  return jsonResponse(500, { error: "internal_error" });
}
