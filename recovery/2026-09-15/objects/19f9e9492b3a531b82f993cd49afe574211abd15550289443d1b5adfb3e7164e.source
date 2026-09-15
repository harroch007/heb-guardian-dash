import { assertFullFifoShape } from "./_shared/incident_full_fifo.ts";
import type { SanitizedIncidentContext } from "./_shared/incident_expert.ts";
function context(contract: string, gates: number[], reasons: string[]) {
  const ref = "abcdefghijklmnopqrstuv";
  return {
    privacy_contract_version: 3,
    conversation_type: "private",
    messages: [{ segment_ref: ref }],
    full_fifo: {
      contract_version: contract,
      case_id: "12345678-1234-4234-8234-123456789012",
      assessment_id: "12345678-1234-4234-8234-123456789013",
      assessment_seq: 1,
      origin_evidence_available: false,
      digest_algorithm: "HMAC_SHA256_JSON_BINARY_V1",
      digest_key_b64: btoa("x".repeat(32)),
      payload_digest: "a".repeat(64),
      snapshot: {
        conversation_revision: 1,
        cutoff_at_ms: 1,
        message_count: 1,
        ordered_segment_refs: [ref],
        message_revisions: [1],
        pending_count: 0,
        coverage_gap: false,
        earliest_evidence_at_ms: 1,
        latest_evidence_at_ms: 1,
      },
      gate_evidence: {
        rule_version: "test",
        evaluated_gates: gates,
        reason_codes: reasons,
      },
    },
  } as unknown as SanitizedIncidentContext;
}
function rejects(fn: () => void) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("expected_rejection");
}
Deno.test("legacy receipt unchanged; new moderation and lazy evidence honest", () => {
  assertFullFifoShape(
    context("THREE_GATE_FULL_FIFO_V1", [1, 2, 3], ["LEGACY_REASON"]),
  );
  assertFullFifoShape(
    context("MODERATION_CONTEXT_FIFO_V1", [1], ["MODERATION_CATEGORY_SCORE"]),
  );
  assertFullFifoShape(
    context("MODERATION_CONTEXT_FIFO_V1", [], ["LAZY_CONTEXT_REVIEW"]),
  );
});
Deno.test("new contract cannot claim old semantic gates or unexplained bypass", () => {
  rejects(() =>
    assertFullFifoShape(
      context("MODERATION_CONTEXT_FIFO_V1", [1, 2, 3], ["MODERATION_FLAGGED"]),
    )
  );
  rejects(() =>
    assertFullFifoShape(
      context("MODERATION_CONTEXT_FIFO_V1", [], ["MODERATION_FLAGGED"]),
    )
  );
  rejects(() =>
    assertFullFifoShape(
      context("MODERATION_CONTEXT_FIFO_V1", [1], ["LAZY_CONTEXT_REVIEW"]),
    )
  );
  rejects(() =>
    assertFullFifoShape(
      context("THREE_GATE_FULL_FIFO_V1", [1], ["MODERATION_FLAGGED"]),
    )
  );
});
