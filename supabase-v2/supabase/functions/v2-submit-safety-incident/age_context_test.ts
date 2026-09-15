import { hashDeviceCredential, requireDevice } from "./_shared/auth.ts";
import type { DeviceIdentity } from "./_shared/auth.ts";
import {
  ageLookupTimeoutMs,
  enrichExpertContextWithAge,
} from "./_shared/incident_age_context.ts";
import {
  buildOpenAIRequest,
  deriveExpertPolicy,
  parseOpenAIResponse,
  parseSanitizedIncidentContext,
} from "./_shared/incident_expert.ts";
import type { SanitizedIncidentContext } from "./_shared/incident_expert.ts";
import {
  fullFifoDigest,
  fullFifoReceipt,
} from "./_shared/incident_full_fifo.ts";

function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error("age_contract_assertion_failed");
  }
}
const deviceId = "44150000-0000-4000-8000-000000000001",
  otherDevice = "44150000-0000-4000-8000-000000000002";
const childId = "33150000-0000-4000-8000-000000000001",
  otherChild = "33150000-0000-4000-8000-000000000002";
const familyId = "22150000-0000-4000-8000-000000000001";
const A = "A".repeat(22), B = "B".repeat(22);
const original: SanitizedIncidentContext = {
  schema_version: 2,
  privacy_contract_version: 3,
  privacy_identity_version: 1,
  conversation_ref: B,
  conversation_type: "group",
  trigger_segment_ref: A,
  evidence_segment_refs: [A],
  redaction_manifest: {},
  safety_context: {
    child_age_band: "age_12_14",
    child_age_confidence: 1,
    child_age_evidence: "birth_year_calendar_estimate",
    relationship_type: "unknown",
    relationship_confidence: 0,
    relationship_evidence: "relationship_unavailable",
    conversation_setting: "unknown_group",
    conversation_setting_confidence: 0.8,
    conversation_setting_evidence: "capture_group_semantics_unknown",
    active_trend_counts: { bullying: 1 },
  },
  messages: [{
    segment_ref: A,
    participant_ref: B,
    sequence: 0,
    relative_time_seconds: 0,
    sender_role: "peer",
    source_kind: "text",
    capture_sources: ["accessibility"],
    capture_confidence: {
      conversation: 1,
      message: 1,
      sender: 1,
      direction: 1,
    },
    text: "contract fixture",
  }],
  full_fifo: {
    contract_version: "MODERATION_CONTEXT_FIFO_V1",
    case_id: "66150000-0000-4000-8000-000000000001",
    assessment_id: "77150000-0000-4000-8000-000000000001",
    assessment_seq: 1,
    origin_evidence_available: false,
    digest_algorithm: "HMAC_SHA256_JSON_BINARY_V1",
    digest_key_b64: btoa("a".repeat(32)),
    payload_digest: "a".repeat(64),
    snapshot: {
      conversation_revision: 1,
      cutoff_at_ms: 1000,
      message_count: 1,
      ordered_segment_refs: [A],
      message_revisions: [1],
      pending_count: 0,
      coverage_gap: false,
      earliest_evidence_at_ms: 0,
      latest_evidence_at_ms: 0,
    },
    gate_evidence: {
      rule_version: "test",
      evaluated_gates: [],
      reason_codes: ["LAZY_CONTEXT_REVIEW"],
    },
  },
};
function identity(year?: number | null): DeviceIdentity {
  return { deviceId, childId, trustedBirthYear: year };
}
async function bandRpc(year: number, current: number): Promise<string> {
  const age = current - year;
  return age >= 6 && age <= 8
    ? "age_6_8"
    : age >= 9 && age <= 11
    ? "age_9_11"
    : age >= 12 && age <= 14
    ? "age_12_14"
    : "unknown";
}
Deno.test("trusted registration band reaches model; no birth year or request identity enters model", async () => {
  let args: unknown;
  const enriched = await enrichExpertContextWithAge(
    original,
    identity(2017),
    async (year, current) => {
      args = [year, current];
      return bandRpc(year, current);
    },
    2026,
  );
  equal(args, [2017, 2026]);
  equal(enriched.safety_context?.child_age_band, "age_9_11");
  equal(enriched.safety_context?.child_age_confidence, 0.6);
  equal(
    enriched.safety_context?.child_age_evidence,
    "birth_year_calendar_estimate",
  );
  const request = buildOpenAIRequest(enriched, "kippy_v1_" + "a".repeat(43));
  const payload = JSON.parse(
    (request.input as { content: { text: string }[] }[])[1].content[0].text,
  );
  equal(payload.safety_context.child_age_band, "age_9_11");
  const wire = JSON.stringify(request);
  equal(wire.includes("2017"), false);
  equal(wire.includes("trustedBirthYear"), false);
  equal(wire.includes(deviceId), false);
  equal(wire.includes(childId), false);
  equal(wire.includes("digest_key_b64"), false);
});
Deno.test("year-only estimate has source confidence, including birthday boundaries; unsupported ages remain unknown", async () => {
  for (
    const [year, expected] of [
      [2020, "age_6_8"],
      [2018, "age_6_8"],
      [2017, "age_9_11"],
      [2015, "age_9_11"],
      [2014, "age_12_14"],
      [2012, "age_12_14"],
    ] as const
  ) {
    const enriched = await enrichExpertContextWithAge(
      original,
      identity(year),
      bandRpc,
      2026,
    );
    equal(enriched.safety_context?.child_age_band, expected);
    equal(enriched.safety_context?.child_age_confidence, 0.6);
    // A calendar estimate of nine is deliberately not exported as an exact age.
    equal(Object.hasOwn(enriched.safety_context!, "child_age"), false);
  }
  let calls = 0;
  for (
    const year of [undefined, null, 1999, 2101, 2021, 2011, 2050, NaN, 2017.5]
  ) {
    const enriched = await enrichExpertContextWithAge(
      original,
      identity(year),
      async () => {
        calls++;
        return "age_9_11";
      },
      2026,
    );
    equal(enriched.safety_context?.child_age_band, "unknown");
    equal(enriched.safety_context?.child_age_confidence, 0);
    equal(enriched.safety_context?.child_age_evidence, "child_age_unavailable");
  }
  equal(calls, 0);
});
Deno.test("missing or malformed age RPC response never blocks inference and never trusts submitted age", async () => {
  for (
    const result of [
      null,
      "unknown",
      ["age_9_11"],
      { birth_year: 2017 },
      "age_15_17",
      "age_6_8",
      "age_12_14",
      42,
    ]
  ) {
    const enriched = await enrichExpertContextWithAge(
      original,
      identity(2017),
      async () => result,
      2026,
    );
    equal(enriched.safety_context?.child_age_band, "unknown");
    equal(enriched.safety_context?.child_age_confidence, 0);
  }
  const failed = await enrichExpertContextWithAge(
    original,
    identity(2017),
    async () => {
      throw new Error("unavailable");
    },
    2026,
  );
  equal(failed.safety_context?.child_age_band, "unknown");
  const absent = {
    ...original,
    safety_context: undefined,
    full_fifo: undefined,
  };
  const fallback = await enrichExpertContextWithAge(
    absent,
    identity(),
    bandRpc,
    2026,
  );
  equal(fallback.safety_context?.relationship_type, "unknown");
  const validated = parseSanitizedIncidentContext(
    new TextEncoder().encode(JSON.stringify(fallback)),
    1,
  );
  equal(
    validated.safety_context?.relationship_evidence,
    "relationship_unavailable",
  );
});
Deno.test("optional age lookup is bounded by the original context deadline and skipped near expiry", () => {
  equal(ageLookupTimeoutMs(101_000, 1_000), 500);
  equal(ageLookupTimeoutMs(5_000, 1_000), 200);
  equal(ageLookupTimeoutMs(3_000, 1_000), 100);
  equal(ageLookupTimeoutMs(2_999, 1_000), 0);
  equal(ageLookupTimeoutMs(1_000, 1_000), 0);
  equal(ageLookupTimeoutMs(NaN, 1_000), 0);
});
Deno.test("age enrichment preserves original messages, FIFO digest, receipt identity and non-age safety fields", async () => {
  const before = JSON.stringify(original);
  const enriched = await enrichExpertContextWithAge(
    original,
    identity(2017),
    bandRpc,
    2026,
  );
  equal(JSON.stringify(original), before);
  equal(enriched.messages === original.messages, true);
  equal(enriched.full_fifo === original.full_fifo, true);
  equal(
    await fullFifoDigest(original.messages, original.full_fifo!.digest_key_b64),
    await fullFifoDigest(enriched.messages, enriched.full_fifo!.digest_key_b64),
  );
  equal(
    fullFifoReceipt(original.full_fifo!, "dismissed"),
    fullFifoReceipt(enriched.full_fifo!, "dismissed"),
  );
  equal(
    enriched.safety_context?.active_trend_counts,
    original.safety_context?.active_trend_counts,
  );
  equal(
    enriched.safety_context?.relationship_type,
    original.safety_context?.relationship_type,
  );
  equal(
    enriched.safety_context?.conversation_setting,
    original.safety_context?.conversation_setting,
  );
  const core = {
    outcome: "dismissed",
    primary_category: null,
    secondary_categories: [],
    severity: null,
    urgency: "routine",
    child_role: "unknown",
    pattern: "isolated",
    confidence: 0.9,
    evidence_segment_refs: [A],
  };
  const response = {
    model: "gpt-5.6-luna",
    status: "completed",
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(core) }],
    }],
  };
  equal(
    deriveExpertPolicy(parseOpenAIResponse(response, original).analysis),
    deriveExpertPolicy(parseOpenAIResponse(response, enriched).analysis),
  );
});

/** Minimal in-memory PostgREST query fixture: no network/provider, no private data. */
async function authFixture() {
  const token = "x".repeat(40);
  const credentialHash = await hashDeviceCredential(token);
  const rows: Record<string, Record<string, unknown>[]> = {
    v2_device_credentials: [{
      device_id: deviceId,
      credential_hash: credentialHash,
      revoked_at: null,
      valid_from: "2020-01-01T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
    }],
    v2_protected_devices: [{
      id: deviceId,
      child_id: childId,
      status: "active",
    }, { id: otherDevice, child_id: otherChild, status: "active" }],
    v2_children: [{
      id: childId,
      family_id: familyId,
      status: "active",
      birth_year: 2017,
    }, {
      id: otherChild,
      family_id: familyId,
      status: "active",
      birth_year: 2010,
    }],
    v2_families: [{ id: familyId, status: "active" }],
  };
  const queries: {
    table: string;
    columns: string;
    filters: [string, unknown][];
  }[] = [];
  const client = {
    from(table: string) {
      let filtered = rows[table] ?? [];
      const query = { table, columns: "", filters: [] as [string, unknown][] };
      queries.push(query);
      const chain = {
        select(columns: string) {
          query.columns = columns;
          return chain;
        },
        eq(key: string, value: unknown) {
          query.filters.push([key, value]);
          filtered = filtered.filter((r) => r[key] === value);
          return chain;
        },
        is(key: string, value: unknown) {
          filtered = filtered.filter((r) => r[key] === value);
          return chain;
        },
        in(key: string, values: unknown[]) {
          filtered = filtered.filter((r) => values.includes(r[key]));
          return chain;
        },
        lte(key: string, value: string) {
          filtered = filtered.filter((r) => String(r[key]) <= value);
          return chain;
        },
        gt(key: string, value: string) {
          filtered = filtered.filter((r) => String(r[key]) > value);
          return chain;
        },
        async maybeSingle() {
          return {
            error: null,
            data: filtered[0]
              ? Object.fromEntries(
                query.columns.split(",").map(
                  (k) => [k.trim(), filtered[0][k.trim()]],
                ),
              )
              : null,
          };
        },
      };
      return chain;
    },
  } as unknown as Parameters<typeof requireDevice>[1];
  return { client, queries, token, rows };
}
Deno.test("age source is credential-bound device child; body child IDs cannot select another profile", async () => {
  const fixture = await authFixture();
  const request = new Request("https://example.invalid/incident", {
    method: "POST",
    headers: {
      "x-kippy-device-id": deviceId,
      authorization: `Bearer ${fixture.token}`,
    },
    body: JSON.stringify({ child_id: otherChild, birth_year: 2010 }),
  });
  const authenticated = await requireDevice(request, fixture.client);
  equal(authenticated.childId, childId);
  equal(authenticated.trustedBirthYear, 2017);
  const query = fixture.queries.find((q) => q.table === "v2_children")!;
  equal(
    query.filters.some(([key, value]) => key === "id" && value === childId),
    true,
  );
  equal(query.filters.some(([, value]) => value === otherChild), false);
  equal(query.columns.includes("birth_year"), true);
});
Deno.test("wrong device credential and inactive child are rejected before age enrichment", async () => {
  for (const mode of ["other_device", "inactive_child"]) {
    const fixture = await authFixture();
    if (mode === "inactive_child") {
      fixture.rows.v2_children[0].status = "archived";
    }
    let rejected = false;
    try {
      await requireDevice(
        new Request("https://example.invalid/incident", {
          headers: {
            "x-kippy-device-id": mode === "other_device"
              ? otherDevice
              : deviceId,
            authorization: `Bearer ${fixture.token}`,
          },
        }),
        fixture.client,
      );
    } catch {
      rejected = true;
    }
    equal(rejected, true);
    if (mode === "other_device") {
      equal(fixture.queries.some((q) => q.table === "v2_children"), false);
    }
  }
});
