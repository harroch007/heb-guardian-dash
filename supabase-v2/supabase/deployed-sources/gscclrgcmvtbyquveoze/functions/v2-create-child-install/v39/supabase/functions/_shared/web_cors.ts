const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS =
  "authorization, apikey, content-type, x-client-info, x-supabase-api-version";

/**
 * Exact-origin CORS for the guardian PWA. This deliberately never falls back
 * to "*": the browser entry points carry a guardian bearer token or a
 * one-time child-install token.
 */
export function webCorsPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;

  const origin = allowedOrigin(request);
  if (!origin) {
    return new Response(null, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export function withWebCors(
  request: Request,
  response: Response,
): Response {
  const origin = allowedOrigin(request);
  if (!origin) return response;

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function allowedOrigin(request: Request): string | null {
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));
  if (!requestOrigin) return null;

  const configured = [
    Deno.env.get("KIPPY_PUBLIC_WEB_URL") ?? "",
    ...(Deno.env.get("KIPPY_ALLOWED_WEB_ORIGINS") ?? "").split(","),
  ]
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null);

  return configured.includes(requestOrigin) ? requestOrigin : null;
}

function normalizeOrigin(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-headers": ALLOWED_HEADERS,
    "access-control-max-age": "3600",
    "vary": "Origin",
  };
}
