import { classifyPushHttpStatus } from "../_shared/push_delivery.ts";
import {
  buildMonitoringPushPayload,
  calculateMonitoringProviderTtl,
  callProviderIfMonitoringDeliveryAlive,
  constantTimeEqual,
  monitoringPushDeliveryEnabled,
  normalizeMonitoringPushClaim,
} from "./contract.ts";

const NOW = Date.parse("2026-08-31T12:00:00.000Z");
const DELIVERY_ID = "10000000-0000-4000-8000-000000000001";
const TRANSITION_ID = "10000000-0000-4000-8000-000000000002";
const DEVICE_ID = "10000000-0000-4000-8000-000000000003";
const CHILD_ID = "10000000-0000-4000-8000-000000000004";
const EPISODE_ID = "10000000-0000-4000-8000-000000000005";
const ENDPOINT_ID = "10000000-0000-4000-8000-000000000006";

Deno.test("strict monitoring claim parsing accepts the exact RPC shape", () => {
  const normalized = normalizeMonitoringPushClaim(validClaim());
  assertEquals(normalized.delivery_id, DELIVERY_ID);
  assertEquals(normalized.alert_type, "monitoring_interrupted");
  assertEquals(normalized.severity, "critical");
  assertEquals(normalized.targets.length, 1);
});

Deno.test("strict monitoring claim parsing rejects extra or unsafe fields", () => {
  assertThrows(() =>
    normalizeMonitoringPushClaim({
      ...validClaim(),
      guardian_user_id: "10000000-0000-4000-8000-000000000099",
    })
  );
  assertThrows(() =>
    normalizeMonitoringPushClaim({
      ...validClaim(),
      alert_type: "monitoring_late",
    })
  );
  assertThrows(() =>
    normalizeMonitoringPushClaim({
      ...validClaim(),
      severity: "warning",
    })
  );
  assertThrows(() =>
    normalizeMonitoringPushClaim({
      ...validClaim(),
      targets: [
        validTarget(),
        validTarget(),
      ],
    })
  );
  assertThrows(() =>
    normalizeMonitoringPushClaim({
      ...validClaim(),
      targets: [{ ...validTarget(), child_name: "private" }],
    })
  );
});

Deno.test("monitoring payload is generic and separate from incident alerts", () => {
  const payload = buildMonitoringPushPayload({
    alert_type: "monitoring_interrupted",
    severity: "critical",
    transition_id: TRANSITION_ID,
  });
  const serialized = JSON.stringify(payload);

  assertEquals(payload.contract_version, 1);
  assertEquals(payload.type, "kippy_monitoring_status");
  assertEquals(
    payload.url,
    `/family-v2?monitoring_transition=${TRANSITION_ID}`,
  );
  assertFalse(serialized.includes("/alerts-v2"));
  assertFalse(serialized.includes(CHILD_ID));
  assertFalse(serialized.includes(DEVICE_ID));
  assertFalse(serialized.includes(EPISODE_ID));
  assertFalse(serialized.includes("child_name"));
  assertFalse(serialized.includes("incident"));
  assertFalse(serialized.includes("location"));
});

Deno.test("shared provider classifier preserves accepted invalid and retryable outcomes", () => {
  assertEquals(
    classifyPushHttpStatus(ENDPOINT_ID, 201),
    { endpoint_id: ENDPOINT_ID, outcome: "sent", http_status: 201 },
  );
  assertEquals(
    classifyPushHttpStatus(ENDPOINT_ID, 410),
    {
      endpoint_id: ENDPOINT_ID,
      outcome: "invalid",
      http_status: 410,
      error_code: "subscription_gone",
    },
  );
  assertEquals(
    classifyPushHttpStatus(ENDPOINT_ID, 429),
    {
      endpoint_id: ENDPOINT_ID,
      outcome: "failed",
      http_status: 429,
      error_code: "push_rate_limited",
    },
  );
});

Deno.test("dynamic provider TTL is exact capped and expired fail-closed", () => {
  assertEquals(
    calculateMonitoringProviderTtl(
      "2026-08-31T12:00:42.900Z",
      NOW,
    ),
    42,
  );
  assertEquals(
    calculateMonitoringProviderTtl(
      "2026-09-02T12:00:00.000Z",
      NOW,
    ),
    86400,
  );
  assertEquals(
    calculateMonitoringProviderTtl(
      "2026-08-31T12:00:00.999Z",
      NOW,
    ),
    null,
  );
  assertEquals(
    calculateMonitoringProviderTtl(
      "2026-08-31T12:00:00.000Z",
      NOW,
    ),
    null,
  );
  assertEquals(
    calculateMonitoringProviderTtl(
      "2026-08-31T11:59:59.000Z",
      NOW,
    ),
    null,
  );
});

Deno.test("expired delivery cannot call the provider", async () => {
  let providerCallCount = 0;
  const expired = await callProviderIfMonitoringDeliveryAlive(
    "2026-08-31T12:00:00.999Z",
    async () => {
      providerCallCount += 1;
      return "unexpected";
    },
    NOW,
  );
  assertEquals(expired, { called: false });
  assertEquals(providerCallCount, 0);

  const alive = await callProviderIfMonitoringDeliveryAlive(
    "2026-08-31T12:00:10.900Z",
    async (ttl) => {
      providerCallCount += 1;
      return ttl;
    },
    NOW,
  );
  assertEquals(alive, { called: true, ttl: 10, result: 10 });
  assertEquals(providerCallCount, 1);
});

Deno.test("trigger comparison and feature flag fail closed", () => {
  const token = "a".repeat(64);
  assertTrue(constantTimeEqual(token, token));
  assertFalse(constantTimeEqual(token, `${"a".repeat(63)}b`));
  assertFalse(constantTimeEqual(token, `${token}a`));
  assertTrue(monitoringPushDeliveryEnabled("true"));
  assertFalse(monitoringPushDeliveryEnabled(undefined));
  assertFalse(monitoringPushDeliveryEnabled("false"));
  assertFalse(monitoringPushDeliveryEnabled("TRUE"));
  assertFalse(monitoringPushDeliveryEnabled("1"));
});

function validClaim(): Record<string, unknown> {
  return {
    delivery_id: DELIVERY_ID,
    transition_id: TRANSITION_ID,
    device_id: DEVICE_ID,
    child_id: CHILD_ID,
    episode_id: EPISODE_ID,
    transition_state_version: 3,
    alert_type: "monitoring_interrupted",
    severity: "critical",
    lease_token: "a".repeat(64),
    attempt_number: 1,
    expires_at: "2026-08-31T13:00:00.000Z",
    targets: [validTarget()],
  };
}

function validTarget(): Record<string, unknown> {
  return {
    endpoint_id: ENDPOINT_ID,
    endpoint: `https://fcm.googleapis.com/fcm/send/${"a".repeat(32)}`,
    p256dh: "A".repeat(88),
    auth: "B".repeat(24),
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

function assertTrue(value: boolean): void {
  if (!value) throw new Error("assertTrue failed");
}

function assertFalse(value: boolean): void {
  if (value) throw new Error("assertFalse failed");
}
