import { isUuid } from "../_shared/auth.ts";
import {
  isAllowedWebPushEndpoint,
  type PushTarget,
} from "../_shared/push_delivery.ts";

export type MonitoringPushAlertType =
  | "monitoring_action_required"
  | "monitoring_interrupted"
  | "monitoring_restored";

export type MonitoringPushSeverity = "info" | "warning" | "critical";

export interface ClaimedMonitoringPushDelivery {
  delivery_id: string;
  transition_id: string;
  device_id: string;
  child_id: string;
  episode_id: string;
  transition_state_version: number;
  alert_type: MonitoringPushAlertType;
  severity: MonitoringPushSeverity;
  lease_token: string;
  attempt_number: number;
  expires_at: string;
  targets: PushTarget[];
}

export interface MonitoringPushPayload {
  contract_version: 1;
  type: "kippy_monitoring_status";
  alert_type: MonitoringPushAlertType;
  severity: MonitoringPushSeverity;
  transition_id: string;
  title: string;
  body: string;
  icon: string;
  badge: string;
  dir: "rtl";
  lang: "he";
  tag: string;
  url: string;
}

export type DynamicProviderCall<T> =
  | { called: false }
  | { called: true; ttl: number; result: T };

const BASE64_URL = /^[A-Za-z0-9_-]+={0,2}$/;
const LEASE_TOKEN = /^[0-9a-f]{64}$/;
const CLAIM_KEYS = [
  "alert_type",
  "attempt_number",
  "child_id",
  "delivery_id",
  "device_id",
  "episode_id",
  "expires_at",
  "lease_token",
  "severity",
  "targets",
  "transition_id",
  "transition_state_version",
] as const;
const TARGET_KEYS = ["auth", "endpoint", "endpoint_id", "p256dh"] as const;

export function normalizeMonitoringPushClaim(
  value: unknown,
): ClaimedMonitoringPushDelivery {
  if (!isRecord(value) || !hasExactKeys(value, CLAIM_KEYS)) {
    throw new Error("invalid_monitoring_push_claim");
  }

  const alertType = value.alert_type;
  const severity = value.severity;
  if (
    !isUuid(value.delivery_id) ||
    !isUuid(value.transition_id) ||
    !isUuid(value.device_id) ||
    !isUuid(value.child_id) ||
    !isUuid(value.episode_id) ||
    !isMonitoringAlertType(alertType) ||
    !isMonitoringSeverity(severity) ||
    !validAlertSeverity(alertType, severity) ||
    typeof value.lease_token !== "string" ||
    !LEASE_TOKEN.test(value.lease_token) ||
    !Number.isSafeInteger(value.transition_state_version) ||
    Number(value.transition_state_version) < 1 ||
    !Number.isInteger(value.attempt_number) ||
    Number(value.attempt_number) < 1 ||
    Number(value.attempt_number) > 5 ||
    typeof value.expires_at !== "string" ||
    !validTimestamp(value.expires_at) ||
    !Array.isArray(value.targets) ||
    value.targets.length < 1 ||
    value.targets.length > 8
  ) {
    throw new Error("invalid_monitoring_push_claim");
  }

  const seenEndpointIds = new Set<string>();
  const targets = value.targets.map((target) => {
    if (!isRecord(target) || !hasExactKeys(target, TARGET_KEYS)) {
      throw new Error("invalid_monitoring_push_claim");
    }
    if (
      !isUuid(target.endpoint_id) ||
      seenEndpointIds.has(target.endpoint_id) ||
      typeof target.endpoint !== "string" ||
      !isAllowedWebPushEndpoint(target.endpoint) ||
      typeof target.p256dh !== "string" ||
      target.p256dh.length < 80 ||
      target.p256dh.length > 120 ||
      !BASE64_URL.test(target.p256dh) ||
      typeof target.auth !== "string" ||
      target.auth.length < 16 ||
      target.auth.length > 64 ||
      !BASE64_URL.test(target.auth)
    ) {
      throw new Error("invalid_monitoring_push_claim");
    }

    seenEndpointIds.add(target.endpoint_id);
    return {
      endpoint_id: target.endpoint_id,
      endpoint: target.endpoint,
      p256dh: target.p256dh,
      auth: target.auth,
    };
  });

  return {
    delivery_id: value.delivery_id,
    transition_id: value.transition_id,
    device_id: value.device_id,
    child_id: value.child_id,
    episode_id: value.episode_id,
    transition_state_version: Number(value.transition_state_version),
    alert_type: alertType,
    severity,
    lease_token: value.lease_token,
    attempt_number: Number(value.attempt_number),
    expires_at: value.expires_at,
    targets,
  };
}

export function buildMonitoringPushPayload(
  claim: Pick<
    ClaimedMonitoringPushDelivery,
    "alert_type" | "severity" | "transition_id"
  >,
): MonitoringPushPayload {
  if (
    !isMonitoringAlertType(claim.alert_type) ||
    !isMonitoringSeverity(claim.severity) ||
    !validAlertSeverity(claim.alert_type, claim.severity) ||
    !isUuid(claim.transition_id)
  ) {
    throw new Error("invalid_monitoring_push_payload");
  }

  return {
    contract_version: 1,
    type: "kippy_monitoring_status",
    alert_type: claim.alert_type,
    severity: claim.severity,
    transition_id: claim.transition_id,
    title: "קיפי — עדכון ניטור",
    body: "מצב הניטור השתנה. פתחו את קיפי כדי לראות את המצב העדכני.",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    dir: "rtl",
    lang: "he",
    tag: `kippy-monitoring-${claim.transition_id}`,
    url: `/family-v2?monitoring_transition=${claim.transition_id}`,
  };
}

// The provider TTL is a row-lifetime contract. A null result means there is no
// positive whole second left and a provider request is forbidden.
export function calculateMonitoringProviderTtl(
  expiresAt: string,
  nowMilliseconds: number = Date.now(),
): number | null {
  const expiresAtMilliseconds = Date.parse(expiresAt);
  if (
    !Number.isFinite(expiresAtMilliseconds) ||
    !Number.isFinite(nowMilliseconds)
  ) {
    throw new Error("invalid_monitoring_push_expiry");
  }

  const remainingSeconds = Math.floor(
    (expiresAtMilliseconds - nowMilliseconds) / 1000,
  );
  if (remainingSeconds <= 0) return null;
  return Math.min(86400, remainingSeconds);
}

// The callback is the only place a provider operation can occur. TTL is
// calculated immediately before it, which makes expiry a testable no-call gate.
export async function callProviderIfMonitoringDeliveryAlive<T>(
  expiresAt: string,
  providerCall: (ttl: number) => Promise<T>,
  nowMilliseconds: number = Date.now(),
): Promise<DynamicProviderCall<T>> {
  const ttl = calculateMonitoringProviderTtl(expiresAt, nowMilliseconds);
  if (ttl === null) return { called: false };
  return {
    called: true,
    ttl,
    result: await providerCall(ttl),
  };
}

export function monitoringPushDeliveryEnabled(
  value: string | undefined,
): boolean {
  return value === "true";
}

function isMonitoringAlertType(
  value: unknown,
): value is MonitoringPushAlertType {
  return value === "monitoring_action_required" ||
    value === "monitoring_interrupted" ||
    value === "monitoring_restored";
}

function isMonitoringSeverity(value: unknown): value is MonitoringPushSeverity {
  return value === "info" || value === "warning" || value === "critical";
}

function validAlertSeverity(
  alertType: MonitoringPushAlertType,
  severity: MonitoringPushSeverity,
): boolean {
  return (
    (alertType === "monitoring_action_required" && severity === "warning") ||
    (alertType === "monitoring_interrupted" && severity === "critical") ||
    (alertType === "monitoring_restored" && severity === "info")
  );
}

function validTimestamp(value: string): boolean {
  return value.length >= 20 &&
    value.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) &&
    Number.isFinite(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}
