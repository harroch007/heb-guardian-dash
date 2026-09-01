const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS =
  "authorization, apikey, content-type, x-client-info, x-supabase-api-version";
const KIPPY_CANONICAL_WEB_ORIGINS = [
  "https://kippyai.com",
  "https://www.kippyai.com",
] as const;

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
  return resolveAllowedWebOrigin(
    request.headers.get("origin"),
    Deno.env.get("KIPPY_PUBLIC_WEB_URL") ?? "",
    Deno.env.get("KIPPY_ALLOWED_WEB_ORIGINS") ?? "",
  );
}

/**
 * The apex and www Kippy origins are one product surface. When either is the
 * configured public URL, accept only that exact pair; additional configured
 * origins remain exact matches and no wildcard fallback is ever introduced.
 */
export function resolveAllowedWebOrigin(
  requestOriginValue: string | null,
  publicWebUrlValue: string,
  additionalOriginsValue: string,
): string | null {
  const requestOrigin = normalizeOrigin(requestOriginValue);
  if (!requestOrigin) return null;

  const configured = new Set<string>();
  const publicWebOrigin = normalizeOrigin(publicWebUrlValue);
  if (publicWebOrigin) {
    configured.add(publicWebOrigin);
    if (
      KIPPY_CANONICAL_WEB_ORIGINS.some(
        (canonicalOrigin) => canonicalOrigin === publicWebOrigin,
      )
    ) {
      for (const canonicalOrigin of KIPPY_CANONICAL_WEB_ORIGINS) {
        configured.add(canonicalOrigin);
      }
    }
  }

  for (const candidate of additionalOriginsValue.split(",")) {
    const origin = normalizeOrigin(candidate);
    if (origin) configured.add(origin);
  }

  return configured.has(requestOrigin) ? requestOrigin : null;
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
