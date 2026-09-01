import type { PushTargetResult } from "../_shared/push_delivery.ts";
import {
  normalizeMonitoringDispatchContext,
  summarizeMonitoringProviderResults,
} from "./circuit_breaker.ts";

const DISPATCH_ID = "10000000-0000-4000-8000-000000000001";

Deno.test("monitoring dispatcher context accepts only the bounded database contract", () => {
  assertEquals(
    normalizeMonitoringDispatchContext(validContext()),
    validContext(),
  );

  for (
    const invalid of [
      { ...validContext(), contract_version: 2 },
      { ...validContext(), source: "manual" },
      { ...validContext(), dispatch_id: "not-a-uuid" },
      { ...validContext(), dispatch_sequence: 0 },
      { ...validContext(), dispatch_sequence: 9 },
      { ...validContext(), dispatch_sequence: 1.5 },
      { ...validContext(), extra: true },
      {
        contract_version: 1,
        source: "pg_cron",
        dispatch_id: DISPATCH_ID,
      },
    ]
  ) {
    assertThrows(() => normalizeMonitoringDispatchContext(invalid));
  }
});

Deno.test("provider summary excludes expiry and counts transient technical failures", () => {
  const results: PushTargetResult[] = [
    {
      endpoint_id: "10000000-0000-4000-8000-000000000011",
      outcome: "sent",
      http_status: 201,
    },
    {
      endpoint_id: "10000000-0000-4000-8000-000000000012",
      outcome: "invalid",
      http_status: 410,
      error_code: "subscription_gone",
    },
    {
      endpoint_id: "10000000-0000-4000-8000-000000000013",
      outcome: "failed",
      http_status: 429,
      error_code: "push_rate_limited",
    },
    {
      endpoint_id: "10000000-0000-4000-8000-000000000014",
      outcome: "failed",
      error_code: "push_transport_failed",
    },
    {
      endpoint_id: "10000000-0000-4000-8000-000000000015",
      outcome: "failed",
      error_code: "delivery_expired",
    },
  ];

  assertEquals(summarizeMonitoringProviderResults(results), {
    providerAttemptCount: 4,
    transientFailureCount: 2,
  });
});

Deno.test("device-state volume cannot appear as a provider failure signal", () => {
  assertEquals(summarizeMonitoringProviderResults([]), {
    providerAttemptCount: 0,
    transientFailureCount: 0,
  });
  assertEquals(
    summarizeMonitoringProviderResults([
      {
        endpoint_id: "10000000-0000-4000-8000-000000000021",
        outcome: "failed",
        error_code: "delivery_expired",
      },
    ]),
    { providerAttemptCount: 0, transientFailureCount: 0 },
  );
});

function validContext(): Record<string, unknown> {
  return {
    contract_version: 1,
    source: "pg_cron",
    dispatch_id: DISPATCH_ID,
    dispatch_sequence: 1,
  };
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${
        JSON.stringify(expected)
      }`,
    );
  }
}

function assertThrows(callback: () => unknown): void {
  let threw = false;
  try {
    callback();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("assertThrows failed");
}
