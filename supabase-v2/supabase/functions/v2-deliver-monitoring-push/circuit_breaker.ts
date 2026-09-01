import type { PushTargetResult } from "../_shared/push_delivery.ts";

export interface MonitoringDispatchContext {
  contract_version: 1;
  source: "pg_cron";
  dispatch_id: string;
  dispatch_sequence: number;
}

export interface MonitoringProviderResultSummary {
  providerAttemptCount: number;
  transientFailureCount: number;
}

const DISPATCH_CONTEXT_KEYS = [
  "contract_version",
  "dispatch_id",
  "dispatch_sequence",
  "source",
] as const;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeMonitoringDispatchContext(
  value: unknown,
): MonitoringDispatchContext {
  if (!isRecord(value)) throw new Error("invalid_monitoring_dispatch_context");

  const keys = Object.keys(value).sort();
  if (
    keys.length !== DISPATCH_CONTEXT_KEYS.length ||
    keys.some((key, index) => key !== DISPATCH_CONTEXT_KEYS[index])
  ) {
    throw new Error("invalid_monitoring_dispatch_context");
  }

  if (
    value.contract_version !== 1 ||
    value.source !== "pg_cron" ||
    typeof value.dispatch_id !== "string" ||
    !UUID_V4_PATTERN.test(value.dispatch_id) ||
    !Number.isInteger(value.dispatch_sequence) ||
    Number(value.dispatch_sequence) < 1 ||
    Number(value.dispatch_sequence) > 8
  ) {
    throw new Error("invalid_monitoring_dispatch_context");
  }

  return {
    contract_version: 1,
    source: "pg_cron",
    dispatch_id: value.dispatch_id,
    dispatch_sequence: Number(value.dispatch_sequence),
  };
}

export function summarizeMonitoringProviderResults(
  results: readonly PushTargetResult[],
): MonitoringProviderResultSummary {
  let providerAttemptCount = 0;
  let transientFailureCount = 0;

  for (const result of results) {
    // delivery_expired is created before any provider call. Queue volume and
    // expiry are product/runtime signals, not provider failures.
    if (
      result.outcome === "failed" && result.error_code === "delivery_expired"
    ) {
      continue;
    }
    providerAttemptCount += 1;
    if (result.outcome === "failed") transientFailureCount += 1;
  }

  return { providerAttemptCount, transientFailureCount };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
