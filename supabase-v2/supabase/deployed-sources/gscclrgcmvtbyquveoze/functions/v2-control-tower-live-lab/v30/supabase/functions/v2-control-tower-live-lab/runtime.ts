import {
  LIVE_LAB_REQUEST_SCHEMA,
  LiveLabProviderError,
  type LiveLabRequest,
  runLiveLab,
} from "./live_lab.ts";
import { isLiveLabScenarioId } from "./scenarios.ts";

const MAX_REQUEST_BYTES = 8 * 1_024;
const MAX_AUTH_RESPONSE_BYTES = 32 * 1_024;
const SAFE_SESSION_ID = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,63})$/;
const SAFE_GENERATED_ID = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,79})$/;
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const RATE_WINDOW_MS = 5 * 60 * 1_000;
const RATE_WINDOW_MAX = 5;

interface OperatorRateState {
  windowStartedAt: number;
  requestCount: number;
  inFlight: number;
}

const operatorRateStates = new Map<string, OperatorRateState>();

export interface LiveLabRuntimeDependencies {
  readonly fetch: typeof fetch;
  readonly env: (name: string) => string | undefined;
  readonly now: () => number;
  readonly createId: () => string;
}

interface RuntimeConfig {
  readonly allowedOrigins: ReadonlySet<string>;
  readonly allowedEmails: ReadonlySet<string>;
  readonly openAiKey: string;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
}

class LiveLabHttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = "LiveLabHttpError";
  }
}

export async function handleLiveLabRequest(
  request: Request,
  dependencies: LiveLabRuntimeDependencies,
): Promise<Response> {
  const origin = normalizedRequestOrigin(request.headers.get("origin"));
  const baseOrigins = parseAllowedOrigins(
    dependencies.env("KIPPY_ALLOWED_WEB_ORIGINS"),
    dependencies.env("KIPPY_RUNTIME_ENV"),
  );

  if (!origin || !baseOrigins.has(origin)) {
    return jsonResponse(403, { error: "origin_not_allowed" });
  }
  const withCors = (response: Response): Response => addCors(response, origin);

  if (request.method === "OPTIONS") {
    if (!runtimeEnabled(dependencies.env)) {
      return withCors(jsonResponse(503, { error: "live_lab_unavailable" }));
    }
    return withCors(
      new Response(null, {
        status: 204,
        headers: { "cache-control": "no-store" },
      }),
    );
  }
  if (request.method !== "POST") {
    return withCors(jsonResponse(405, { error: "method_not_allowed" }));
  }
  if (!runtimeEnabled(dependencies.env)) {
    return withCors(jsonResponse(503, { error: "live_lab_unavailable" }));
  }

  const startedAt = dependencies.now();
  let releaseRateSlot: (() => void) | undefined;
  try {
    const config = readRuntimeConfig(dependencies.env, baseOrigins);
    assertJsonContentType(request.headers.get("content-type"));
    const bearer = readBearer(request.headers.get("authorization"));
    const operatorKey = await authorizeOperator(
      bearer,
      config,
      dependencies.fetch,
    );
    releaseRateSlot = acquireRateSlot(operatorKey, startedAt);
    const payload = await readRequest(request);
    const generatedId = dependencies.createId();
    if (!SAFE_GENERATED_ID.test(generatedId)) {
      throw new LiveLabHttpError(503, "live_lab_configuration_invalid");
    }

    const result = await runLiveLab(
      {
        request: payload,
        apiKey: config.openAiKey,
        runId: `live_${generatedId}`,
        totalMs: () => dependencies.now() - startedAt,
      },
      { fetch: dependencies.fetch },
    );
    return withCors(jsonResponse(200, result));
  } catch (error) {
    if (error instanceof LiveLabHttpError) {
      return withCors(jsonResponse(error.status, { error: error.code }));
    }
    if (error instanceof LiveLabProviderError) {
      return withCors(jsonResponse(502, { error: "live_lab_model_failed" }));
    }
    return withCors(jsonResponse(500, { error: "live_lab_failed_closed" }));
  } finally {
    releaseRateSlot?.();
  }
}

function runtimeEnabled(
  env: LiveLabRuntimeDependencies["env"],
): boolean {
  return env("KIPPY_LIVE_LAB_ENABLED") === "true" &&
    env("KIPPY_RUNTIME_ENV") === "staging";
}

function readRuntimeConfig(
  env: LiveLabRuntimeDependencies["env"],
  allowedOrigins: ReadonlySet<string>,
): RuntimeConfig {
  if (allowedOrigins.size === 0) {
    throw new LiveLabHttpError(503, "live_lab_configuration_invalid");
  }
  const allowedEmails = parseAllowedEmails(
    env("KIPPY_LIVE_LAB_ALLOWED_EMAILS"),
  );
  // OPEN_AI_KEY is a compatibility fallback for the existing staging secret.
  const primaryOpenAiKey = (env("OPENAI_API_KEY") ?? "").trim();
  const openAiKey = primaryOpenAiKey || (env("OPEN_AI_KEY") ?? "").trim();
  const supabaseUrl = normalizeSupabaseUrl(env("SUPABASE_URL") ?? "");
  const supabaseAnonKey = (
    env("SUPABASE_ANON_KEY") ?? env("SUPABASE_PUBLISHABLE_KEY") ?? ""
  ).trim();

  if (
    env("KIPPY_LIVE_LAB_DATA_MODE") !==
      "canned_synthetic_default_retention" ||
    allowedEmails.size === 0 ||
    openAiKey.length < 20 ||
    openAiKey.length > 512 ||
    !supabaseUrl ||
    supabaseAnonKey.length < 20 ||
    supabaseAnonKey.length > 2_048
  ) {
    throw new LiveLabHttpError(503, "live_lab_configuration_invalid");
  }
  return {
    allowedOrigins,
    allowedEmails,
    openAiKey,
    supabaseUrl,
    supabaseAnonKey,
  };
}

async function authorizeOperator(
  bearer: string,
  config: RuntimeConfig,
  fetchImplementation: typeof fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImplementation(`${config.supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${bearer}`,
        apikey: config.supabaseAnonKey,
        accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new LiveLabHttpError(503, "identity_service_unavailable");
  }
  if (response.status === 401 || response.status === 403) {
    throw new LiveLabHttpError(401, "unauthenticated");
  }
  if (!response.ok) {
    throw new LiveLabHttpError(503, "identity_service_unavailable");
  }
  const body = await readJsonResponse(response, MAX_AUTH_RESPONSE_BYTES);
  if (
    !isRecord(body) ||
    typeof body.id !== "string" ||
    body.id.length === 0 ||
    body.id.length > 200 ||
    typeof body.email !== "string" ||
    !config.allowedEmails.has(body.email.trim().toLowerCase())
  ) {
    throw new LiveLabHttpError(403, "live_lab_access_denied");
  }
  const normalizedEmail = body.email.trim().toLowerCase();

  let adminResponse: Response;
  try {
    adminResponse = await fetchImplementation(
      `${config.supabaseUrl}/rest/v1/rpc/is_admin`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          apikey: config.supabaseAnonKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: "{}",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new LiveLabHttpError(503, "authorization_service_unavailable");
  }
  if (adminResponse.status === 401 || adminResponse.status === 403) {
    throw new LiveLabHttpError(403, "live_lab_access_denied");
  }
  if (!adminResponse.ok) {
    throw new LiveLabHttpError(503, "authorization_service_unavailable");
  }
  const isAdmin = await readJsonResponse(
    adminResponse,
    MAX_AUTH_RESPONSE_BYTES,
  );
  if (isAdmin !== true) {
    throw new LiveLabHttpError(403, "live_lab_access_denied");
  }
  return `${body.id}:${normalizedEmail}`;
}

function acquireRateSlot(operatorKey: string, now: number): () => void {
  let state = operatorRateStates.get(operatorKey);
  if (
    !state || now - state.windowStartedAt >= RATE_WINDOW_MS ||
    now < state.windowStartedAt
  ) {
    state = { windowStartedAt: now, requestCount: 0, inFlight: 0 };
    operatorRateStates.set(operatorKey, state);
  }
  if (state.inFlight >= 1 || state.requestCount >= RATE_WINDOW_MAX) {
    throw new LiveLabHttpError(429, "live_lab_rate_limited");
  }
  state.inFlight += 1;
  state.requestCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state!.inFlight = Math.max(0, state!.inFlight - 1);
  };
}

export function resetLiveLabRateLimitsForTest(): void {
  operatorRateStates.clear();
}

async function readRequest(request: Request): Promise<LiveLabRequest> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) {
      throw new LiveLabHttpError(400, "invalid_content_length");
    }
    if (Number(declared) > MAX_REQUEST_BYTES) {
      throw new LiveLabHttpError(413, "payload_too_large");
    }
  }
  const body = await readJsonRequest(request, MAX_REQUEST_BYTES);
  if (
    !hasOnlyRequestKeys(body) ||
    body.schema_version !== LIVE_LAB_REQUEST_SCHEMA ||
    !isLiveLabScenarioId(body.scenario_id) ||
    body.synthetic_test_only !== true ||
    body.locale !== "he-IL" ||
    (body.session_id !== undefined &&
      (typeof body.session_id !== "string" ||
        !SAFE_SESSION_ID.test(body.session_id)))
  ) {
    throw new LiveLabHttpError(400, "invalid_live_lab_request");
  }
  return {
    schema_version: LIVE_LAB_REQUEST_SCHEMA,
    scenario_id: body.scenario_id,
    synthetic_test_only: true,
    locale: "he-IL",
    ...(body.session_id === undefined ? {} : { session_id: body.session_id }),
  };
}

async function readJsonRequest(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  if (!request.body) {
    throw new LiveLabHttpError(400, "invalid_json");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new LiveLabHttpError(413, "payload_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof LiveLabHttpError) throw error;
    throw new LiveLabHttpError(400, "invalid_json");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error("not_an_object");
    return parsed;
  } catch {
    throw new LiveLabHttpError(400, "invalid_json");
  } finally {
    bytes.fill(0);
  }
}

async function readJsonResponse(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new LiveLabHttpError(503, "identity_service_unavailable");
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new LiveLabHttpError(503, "identity_service_unavailable");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new LiveLabHttpError(503, "identity_service_unavailable");
  }
}

function parseAllowedOrigins(
  value: string | undefined,
  runtimeEnvironment: string | undefined,
): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const candidate of (value ?? "").split(",")) {
    if (!candidate.trim()) continue;
    const normalized = normalizedConfiguredOrigin(candidate);
    if (!normalized) return new Set();
    const configuredUrl = new URL(normalized);
    const configuredLocal = configuredUrl.hostname === "localhost" ||
      configuredUrl.hostname === "127.0.0.1";
    if (configuredLocal && runtimeEnvironment !== "staging") continue;
    origins.add(normalized);
  }
  if (runtimeEnvironment === "staging") {
    origins.add("http://localhost:5173");
    origins.add("http://localhost:8080");
  }
  return origins;
}

function parseAllowedEmails(value: string | undefined): ReadonlySet<string> {
  const emails = new Set<string>();
  for (const candidate of (value ?? "").split(",")) {
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) continue;
    if (!EMAIL_PATTERN.test(normalized)) return new Set();
    emails.add(normalized);
  }
  return emails;
}

function normalizedRequestOrigin(value: string | null): string | null {
  if (!value || value === "null") return null;
  return normalizedConfiguredOrigin(value);
}

function normalizedConfiguredOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const localhost = url.hostname === "localhost" ||
      url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
      return null;
    }
    if (url.username || url.password || url.pathname !== "/") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeSupabaseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    const localhost = url.hostname === "localhost" ||
      url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
      return null;
    }
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function readBearer(value: string | null): string {
  const match = value?.match(/^Bearer ([A-Za-z0-9._~-]{20,4096})$/);
  if (!match) throw new LiveLabHttpError(401, "unauthenticated");
  return match[1];
}

function assertJsonContentType(value: string | null): void {
  if (!value || !/^application\/json(?:\s*;|$)/i.test(value)) {
    throw new LiveLabHttpError(415, "unsupported_media_type");
  }
}

function hasOnlyRequestKeys(value: Record<string, unknown>): boolean {
  const required = [
    "schema_version",
    "scenario_id",
    "synthetic_test_only",
    "locale",
  ];
  const allowed = [...required, "session_id"];
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => allowed.includes(key));
}

function addCors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set(
    "access-control-allow-headers",
    "authorization, content-type, apikey, x-client-info",
  );
  headers.set("access-control-max-age", "3600");
  headers.set("vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
