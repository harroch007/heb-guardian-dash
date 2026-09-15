import { validMessageHistory } from "./_shared/incident_message_history.ts";
import type { SanitizedMessageHistory } from "./_shared/incident_message_history.ts";
import { buildOpenAIRequest, parseSanitizedIncidentContext } from "./_shared/incident_expert.ts";
import type { SanitizedIncidentContext } from "./_shared/incident_expert.ts";
import { fullFifoDigest } from "./_shared/incident_full_fifo.ts";

function assert(value: unknown) { if (!value) throw new Error("assertion_failed"); }
function rejects(action: () => unknown) { let failed = false; try { action(); } catch { failed = true; } assert(failed); }
const A = "A".repeat(22), B = "B".repeat(22);
function history(): SanitizedMessageHistory {
  return {
    contract_version: "KIPPY_MESSAGE_HISTORY_V1", original_availability: "CAPTURED", current_revision_number: 2,
    versions: [{ revision_number: 1, observed_offset_seconds: 0, provenance: "RECORDED_AT_CAPTURE",
      participant_ref: B, sender_role: "peer", capture_sources: ["accessibility"],
      capture_confidence: { conversation: 1, message: 1, sender: 1, direction: 1 }, text: "original retained text" }],
    changes: [{ change_sequence: 1, change_kind: "EDIT_OBSERVED", affected_revision_number: 1,
      result_revision_number: 2, related_change_sequence: null, observed_offset_seconds: 10, changed_offset_seconds: null,
      actor_kind: "UNKNOWN", actor_certainty: "UNKNOWN" },
      { change_sequence: 2, change_kind: "DELETION_OBSERVED", affected_revision_number: 2,
        result_revision_number: null, related_change_sequence: null, observed_offset_seconds: 20, changed_offset_seconds: null,
        actor_kind: "UNKNOWN", actor_certainty: "UNKNOWN" }],
    omitted_revision_count: 0, omitted_change_count: 0, proof_incomplete: false,
  };
}
function context(): SanitizedIncidentContext {
  return { schema_version: 2, privacy_contract_version: 3, privacy_identity_version: 1,
    conversation_ref: B, conversation_type: "group", trigger_segment_ref: A, evidence_segment_refs: [A], redaction_manifest: {},
    safety_context: { child_age_band: "unknown", child_age_confidence: 0, child_age_evidence: "child_age_unavailable",
      relationship_type: "unknown", relationship_confidence: 0, relationship_evidence: "relationship_unavailable",
      conversation_setting: "unknown_group", conversation_setting_confidence: 1,
      conversation_setting_evidence: "capture_group_semantics_unknown", active_trend_counts: {} },
    messages: [{ segment_ref: A, participant_ref: B, sequence: 0, relative_time_seconds: 0,
      sender_role: "peer", source_kind: "text", capture_sources: ["accessibility"],
      capture_confidence: { conversation: 1, message: 1, sender: 1, direction: 1 }, text: "current retained text", history: history() }],
    full_fifo: { contract_version: "MODERATION_CONTEXT_FIFO_V1", case_id: "12345678-1234-4234-8234-123456789012",
      assessment_id: "12345678-1234-4234-8234-123456789013", assessment_seq: 1, origin_evidence_available: false,
      digest_algorithm: "HMAC_SHA256_JSON_BINARY_V1", digest_key_b64: btoa("x".repeat(32)), payload_digest: "a".repeat(64),
      snapshot: { conversation_revision: 1, cutoff_at_ms: 30_000, message_count: 1, ordered_segment_refs: [A],
        message_revisions: [2], pending_count: 0, coverage_gap: false, earliest_evidence_at_ms: 1, latest_evidence_at_ms: 1 },
      gate_evidence: { rule_version: "test", evaluated_gates: [], reason_codes: ["LAZY_CONTEXT_REVIEW"] } } };
}
const parse = (value: unknown) => parseSanitizedIncidentContext(new TextEncoder().encode(JSON.stringify(value)), 1);

Deno.test("history keeps original edit deletion in one model message and keyed digest", async () => {
  const original = context();
  const parsed = parse(original);
  const request = buildOpenAIRequest(parsed, "kippy_v1_" + "a".repeat(43));
  const serialized = JSON.stringify(request);
  assert(parsed.messages.length === 1 && parsed.evidence_segment_refs.length === 1);
  assert(serialized.includes("original retained text") && serialized.includes("DELETION_OBSERVED"));
  assert(serialized.includes("ONE message") && serialized.includes("correction to the capture representation"));
  const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
  const digest = await fullFifoDigest(parsed.messages, key);
  parsed.messages[0].history!.versions[0].text = "changed historical text";
  assert(await fullFifoDigest(parsed.messages, key) !== digest);
  assert(original.messages[0].history!.versions[0].text === "original retained text");
});

Deno.test("history cannot introduce raw proof or actors, dangling links or fabricated duplicate offenses", () => {
  const bad: ((h: SanitizedMessageHistory) => void)[] = [
    (h) => { Object.assign(h, { captureProofJson: "private proof" }); },
    (h) => { h.versions.push(structuredClone(h.versions[0])); },
    (h) => { h.versions[0].revision_number = h.current_revision_number; },
    (h) => { h.changes[0].actor_participant_ref = B; },
    (h) => { h.changes[0].actor_kind = "GROUP_ADMIN"; },
    (h) => { h.changes[1].result_revision_number = 2; },
    (h) => { h.changes[0].affected_revision_number = 99; },
    (h) => { h.changes[0].affected_revision_number = null; h.changes[0].result_revision_number = null; },
    (h) => { h.changes[1].affected_revision_number = null; },
    (h) => { h.changes[0].change_kind = "EVIDENCE_ADDED"; },
    (h) => { h.changes[0].change_kind = "CAPTURE_CORRECTION"; h.changes[0].actor_kind = "MESSAGE_AUTHOR"; h.changes[0].actor_certainty = "CAPTURE_PROVEN"; },
    (h) => { h.omitted_revision_count = 1; },
    (h) => { h.changes[0].changed_offset_seconds = Number.NaN; },
    (h) => { Object.assign(h.versions[0], { senderDisplayName: "private name" }); },
  ];
  assert(validMessageHistory(history(), 8000, 8000));
  for (const mutate of bad) { const value = history(); mutate(value); assert(!validMessageHistory(value, 8000, 8000)); }
});

Deno.test("historical text and quotations pass the same server privacy boundary", () => {
  const rawText = context(); rawText.messages[0].history!.versions[0].text = "private@example.com";
  rejects(() => parse(rawText));
  const quote = context(); quote.messages[0].history!.versions[0].reply_context = { quoted_sender_role: "peer", quoted_text: "private@example.com" };
  rejects(() => parse(quote));
  const long = context(); long.messages[0].history!.versions[0].text = "x".repeat(8001);
  rejects(() => parse(long));
  const partial = context(); partial.messages[0].history!.proof_incomplete = true;
  partial.messages[0].history!.omitted_revision_count = 2;
  assert(parse(partial).messages[0].history!.omitted_revision_count === 2);
});

Deno.test("history requires bound FullFIFO v3 and matching current revision", () => {
  const missing = context(); delete missing.full_fifo;
  rejects(() => parse(missing));
  const old = context(); old.privacy_contract_version = 1;
  rejects(() => parse(old));
  const mismatch = context(); mismatch.full_fifo!.snapshot.message_revisions = [1];
  rejects(() => parse(mismatch));
  const legacy = context(); delete legacy.messages[0].history; delete legacy.full_fifo;
  assert(parse(legacy).messages.length === 1);
});
