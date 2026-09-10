import { supabase } from "@/integrations/supabase/client";
import {
  createChildInstallSession,
  getChildInstallSessionStatus,
  type V2ChildInstallSessionStatus,
} from "./guardianService";

export const RECONNECT_COOLDOWN_MS = 60_000;
export const RECONNECT_MAX_ATTEMPTS = 3;

export type ReconnectFailure =
  | "BUSY" | "CREATE_UNAVAILABLE" | "INVALID_SESSION" | "COOLDOWN"
  | "LIMIT" | "SESSION_CLOSED" | "EMAIL_UNAVAILABLE" | "DELIVERY_FAILED"
  | "DELIVERY_UNKNOWN" | "STATUS_UNAVAILABLE";

export class ChildReconnectError extends Error {
  constructor(readonly code: ReconnectFailure) {
    super(code);
  }
}

export interface ChildReconnectSession {
  sessionId: string;
  expiresAt: number;
  attempts: number;
  retryAt: number;
  status: V2ChildInstallSessionStatus;
  delivery: "requested" | "recent_request_exists" | "unknown" | null;
  blocked: boolean;
}

interface SessionRecord extends ChildReconnectSession {
  childId: string;
  activationToken: string;
  revision: number;
  pollGeneration: number;
}

// Ephemeral only. One session per guardian mirrors the server's cancellation scope.
// Tokens never enter React state, storage, URLs, logs or error messages.
const sessions = new Map<string, SessionRecord>();
const operations = new Map<string, AbortController>();
const REQUEST_TIMEOUT_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let activeGuardian: string | null = null;
let authGeneration = 0;

function setChildReconnectGuardian(guardianId: string | null): void {
  if (activeGuardian === guardianId) return;
  for (const record of sessions.values()) record.activationToken = "";
  sessions.clear();
  activeGuardian = guardianId;
  authGeneration += 1;
  for (const controller of operations.values()) controller.abort();
}

// App-lifetime subscription: route changes keep the current code, while actual
// signout/account changes clear capabilities even when no reconnect modal is mounted.
supabase.auth.onAuthStateChange((_event, session) => {
  setChildReconnectGuardian(session?.user.id ?? null);
});

function isTerminal(status: V2ChildInstallSessionStatus): boolean {
  return status === "consumed" || status === "cancelled" || status === "expired";
}

function view(record: SessionRecord): ChildReconnectSession {
  if (record.expiresAt <= Date.now() && (record.status === "created" || record.status === "activated")) {
    record.status = "expired";
    record.activationToken = "";
  }
  const { sessionId, expiresAt, attempts, retryAt, status, delivery, blocked } = record;
  return { sessionId, expiresAt, attempts, retryAt, status, delivery, blocked };
}

export function getCachedChildReconnectSession(guardianId: string, childId: string): ChildReconnectSession | null {
  if (activeGuardian !== guardianId) return null;
  const record = sessions.get(guardianId);
  const result = record?.childId === childId ? view(record) : null;
  if (record?.expiresAt <= Date.now()) sessions.delete(guardianId);
  return result;
}

function current(guardianId: string, childId: string, sessionId: string): SessionRecord {
  const record = sessions.get(guardianId);
  if (activeGuardian !== guardianId || !record || record.childId !== childId || record.sessionId !== sessionId) {
    throw new ChildReconnectError("SESSION_CLOSED");
  }
  view(record);
  return record;
}

async function bounded<T>(promise: Promise<T>, failure: ReconnectFailure): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ChildReconnectError(failure)), REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function exclusive<T>(
  guardianId: string,
  failure: ReconnectFailure,
  action: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (operations.has(guardianId)) throw new ChildReconnectError("BUSY");
  const controller = new AbortController();
  operations.set(guardianId, controller);
  let rejectAborted: () => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = () => reject(new ChildReconnectError(failure));
    controller.signal.addEventListener("abort", rejectAborted, { once: true });
  });
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Abort the transport before releasing its slot. Late responses are fenced
    // inside the action; server delivery may still have happened, so never retry automatically.
    return await Promise.race([action(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", rejectAborted);
    if (operations.get(guardianId) === controller) operations.delete(guardianId);
  }
}

function expiry(value: unknown): number {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) throw new ChildReconnectError("INVALID_SESSION");
  return time;
}

/** Creates a capability only; never sends email. The caller checks it is still open before activation. */
export async function prepareChildReconnectSession(guardianId: string, childId: string): Promise<ChildReconnectSession> {
  if (activeGuardian !== guardianId) throw new ChildReconnectError("SESSION_CLOSED");
  const generation = authGeneration;
  const cached = getCachedChildReconnectSession(guardianId, childId);
  if (cached && (cached.status === "created" || cached.status === "activated")) return cached;
  return exclusive(guardianId, "CREATE_UNAVAILABLE", async (signal) => {
    try {
      const result = await createChildInstallSession(childId, { signal });
      if (generation !== authGeneration || activeGuardian !== guardianId) throw new ChildReconnectError("SESSION_CLOSED");
      if (signal.aborted) throw new ChildReconnectError("CREATE_UNAVAILABLE");
      const url = new URL(result.activation_url);
      const token = /^\/install\/([A-Za-z0-9_-]{43})$/.exec(url.pathname)?.[1];
      const expiresAt = expiry(result.expires_at);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        !token || result.qr_payload !== result.activation_url || !UUID.test(result.install_session_id) ||
        expiresAt <= Date.now() || expiresAt > Date.now() + 20 * 60_000) {
        throw new ChildReconnectError("INVALID_SESSION");
      }
      const record: SessionRecord = {
        childId, activationToken: token, sessionId: result.install_session_id, expiresAt,
        attempts: 0, retryAt: 0, status: "created", delivery: null, blocked: false, revision: 0, pollGeneration: 0,
      };
      sessions.set(guardianId, record);
      while (sessions.size > 8) sessions.delete(sessions.keys().next().value);
      return view(record);
    } catch (error) {
      throw error instanceof ChildReconnectError ? error : new ChildReconnectError("CREATE_UNAVAILABLE");
    }
  });
}

async function activationFailure(error: unknown): Promise<ReconnectFailure> {
  const response = error && typeof error === "object" && "context" in error ? error.context : null;
  if (!(response instanceof Response)) return "DELIVERY_UNKNOWN";
  try {
    const text = await response.clone().text();
    if (text.length > 2_048) return "DELIVERY_UNKNOWN";
    const code = (JSON.parse(text) as { error?: unknown }).error;
    if (code === "install_link_expired_or_used") return "SESSION_CLOSED";
    if (code === "guardian_email_unavailable" || code === "otp_delivery_configuration_missing") return "EMAIL_UNAVAILABLE";
    if (code === "otp_delivery_failed") return "DELIVERY_FAILED";
    return "DELIVERY_UNKNOWN";
  } catch {
    return "DELIVERY_UNKNOWN";
  }
}

export async function activateChildReconnectSession(
  guardianId: string, childId: string, sessionId: string,
): Promise<ChildReconnectSession> {
  const record = current(guardianId, childId, sessionId);
  const generation = authGeneration;
  if (record.blocked || !["created", "activated"].includes(record.status)) throw new ChildReconnectError("SESSION_CLOSED");
  if (record.attempts >= RECONNECT_MAX_ATTEMPTS) throw new ChildReconnectError("LIMIT");
  if (record.retryAt > Date.now()) throw new ChildReconnectError("COOLDOWN");
  return exclusive(guardianId, "DELIVERY_UNKNOWN", async (signal) => {
    // Unknown delivery consumes the local allowance conservatively; the server remains authoritative.
    record.attempts += 1;
    record.revision += 1;
    record.retryAt = Date.now() + RECONNECT_COOLDOWN_MS;
    record.delivery = "unknown";
    try {
      const { data, error } = await supabase.functions.invoke("v2-activate-child-install", {
        body: { activation_token: record.activationToken },
        signal,
      });
      if (generation !== authGeneration || sessions.get(guardianId) !== record) throw new ChildReconnectError("SESSION_CLOSED");
      if (signal.aborted) throw new ChildReconnectError("DELIVERY_UNKNOWN");
      if (error) {
        const failure = await activationFailure(error);
        if (signal.aborted) throw new ChildReconnectError("DELIVERY_UNKNOWN");
        if (generation !== authGeneration || sessions.get(guardianId) !== record) throw new ChildReconnectError("SESSION_CLOSED");
        throw new ChildReconnectError(failure);
      }
      const delivery = data?.otp_delivery;
      if (data?.activated !== true || !(
        (data.otp_sent === true && delivery === "requested") ||
        (data.otp_sent === false && delivery === "recent_request_exists")
      ) || typeof data.expires_at !== "string" || Date.parse(data.expires_at) !== record.expiresAt) {
        throw new ChildReconnectError("DELIVERY_UNKNOWN");
      }
      record.delivery = delivery;
      if (record.status === "created") record.status = "activated";
      // Start from the response to respect the server reservation even on a slow request.
      record.retryAt = Date.now() + RECONNECT_COOLDOWN_MS;
      return view(record);
    } catch (error) {
      const failure = error instanceof ChildReconnectError ? error : new ChildReconnectError("DELIVERY_UNKNOWN");
      if (failure.code === "SESSION_CLOSED") record.blocked = true;
      throw failure;
    }
  });
}

export async function refreshChildReconnectSession(
  guardianId: string, childId: string, sessionId: string,
): Promise<ChildReconnectSession> {
  const record = current(guardianId, childId, sessionId);
  if (isTerminal(record.status)) return view(record);
  const revision = record.revision;
  const generation = authGeneration;
  const pollGeneration = ++record.pollGeneration;
  const stillCurrent = () => generation === authGeneration && activeGuardian === guardianId && sessions.get(guardianId) === record;
  const superseded = () => record.revision !== revision || record.pollGeneration !== pollGeneration || isTerminal(record.status);
  try {
    const result = await bounded(getChildInstallSessionStatus(sessionId), "STATUS_UNAVAILABLE");
    if (!stillCurrent()) throw new ChildReconnectError("STATUS_UNAVAILABLE");
    if (superseded()) return view(record);
    if (!result || expiry(result.expires_at) !== record.expiresAt) {
      throw new ChildReconnectError("STATUS_UNAVAILABLE");
    }
    // Activation and terminal states cannot be undone by an older server snapshot.
    if (record.status === "activated" && result.status === "created") return view(record);
    record.status = result.status;
    if (isTerminal(record.status)) record.activationToken = "";
    return view(record);
  } catch {
    if (stillCurrent() && superseded()) return view(record);
    throw new ChildReconnectError("STATUS_UNAVAILABLE");
  }
}
