import { isUuid } from "./auth.ts";

export interface PushTarget {
  endpoint_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ClaimedPushDelivery {
  delivery_id: string;
  incident_id: string;
  lease_token: string;
  attempt_number: number;
  targets: PushTarget[];
}

export interface PushTargetResult {
  endpoint_id: string;
  outcome: "sent" | "invalid" | "failed";
  http_status?: number;
  error_code?: string;
}

export interface GuardianPushPayload {
  contract_version: 1;
  type: "kippy_safety_incident";
  title: string;
  body: string;
  icon: string;
  badge: string;
  dir: "rtl";
  lang: "he";
  tag: string;
  url: string;
}

const BASE64_URL = /^[A-Za-z0-9_-]+={0,2}$/;
const LEASE_TOKEN = /^[0-9a-f]{64}$/;

export function normalizePushClaim(value: unknown): ClaimedPushDelivery {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_push_claim");
  }
  const row = value as Record<string, unknown>;
  if (
    !isUuid(row.delivery_id) ||
    !isUuid(row.incident_id) ||
    typeof row.lease_token !== "string" ||
    !LEASE_TOKEN.test(row.lease_token) ||
    !Number.isInteger(row.attempt_number) ||
    Number(row.attempt_number) < 1 ||
    Number(row.attempt_number) > 20 ||
    !Array.isArray(row.targets) ||
    row.targets.length > 8
  ) {
    throw new Error("invalid_push_claim");
  }

  const seen = new Set<string>();
  const targets = row.targets.map((target) => {
    if (
      target === null ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) {
      throw new Error("invalid_push_claim");
    }
    const item = target as Record<string, unknown>;
    if (
      !isUuid(item.endpoint_id) ||
      seen.has(item.endpoint_id) ||
      typeof item.endpoint !== "string" ||
      !isAllowedWebPushEndpoint(item.endpoint) ||
      typeof item.p256dh !== "string" ||
      item.p256dh.length < 80 ||
      item.p256dh.length > 120 ||
      !BASE64_URL.test(item.p256dh) ||
      typeof item.auth !== "string" ||
      item.auth.length < 16 ||
      item.auth.length > 64 ||
      !BASE64_URL.test(item.auth)
    ) {
      throw new Error("invalid_push_claim");
    }
    seen.add(item.endpoint_id);
    return {
      endpoint_id: item.endpoint_id,
      endpoint: item.endpoint,
      p256dh: item.p256dh,
      auth: item.auth,
    };
  });

  return {
    delivery_id: row.delivery_id,
    incident_id: row.incident_id,
    lease_token: row.lease_token,
    attempt_number: Number(row.attempt_number),
    targets,
  };
}

export function isAllowedWebPushEndpoint(endpoint: string): boolean {
  if (
    endpoint.length < 32 ||
    endpoint.length > 2048 ||
    /[\s@]/.test(endpoint)
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host === "push.apple.com" ||
    host.endsWith(".push.apple.com");
}

export function buildGuardianPushPayload(
  incidentId: string,
): GuardianPushPayload {
  if (!isUuid(incidentId)) {
    throw new Error("invalid_push_incident");
  }
  return {
    contract_version: 1,
    type: "kippy_safety_incident",
    title: "קיפי — עדכון בטיחות",
    body:
      "זוהה אירוע שדורש את תשומת לבכם. פתחו את קיפי כדי לראות את הפרטים והצעד המומלץ.",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    dir: "rtl",
    lang: "he",
    tag: `kippy-incident-${incidentId}`,
    url: `/alerts-v2?incident=${incidentId}`,
  };
}

export function classifyPushHttpStatus(
  endpointId: string,
  status: number | null,
): PushTargetResult {
  if (!isUuid(endpointId)) {
    throw new Error("invalid_push_endpoint_id");
  }
  if (status === null) {
    return {
      endpoint_id: endpointId,
      outcome: "failed",
      error_code: "push_transport_error",
    };
  }
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    throw new Error("invalid_push_http_status");
  }
  if (status >= 200 && status <= 299) {
    return {
      endpoint_id: endpointId,
      outcome: "sent",
      http_status: status,
    };
  }
  if (status === 404 || status === 410) {
    return {
      endpoint_id: endpointId,
      outcome: "invalid",
      http_status: status,
      error_code: "subscription_gone",
    };
  }
  if (status === 429) {
    return {
      endpoint_id: endpointId,
      outcome: "failed",
      http_status: status,
      error_code: "push_rate_limited",
    };
  }
  if (status === 401 || status === 403) {
    return {
      endpoint_id: endpointId,
      outcome: "failed",
      http_status: status,
      error_code: "push_auth_rejected",
    };
  }
  if (status >= 500) {
    return {
      endpoint_id: endpointId,
      outcome: "failed",
      http_status: status,
      error_code: "push_provider_unavailable",
    };
  }
  return {
    endpoint_id: endpointId,
    outcome: "failed",
    http_status: status,
    error_code: "push_request_rejected",
  };
}
