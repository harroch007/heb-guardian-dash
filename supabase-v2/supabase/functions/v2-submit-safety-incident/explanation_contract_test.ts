import {
  buildOpenAIRequest,
  deriveExpertPolicy,
  EXPERT_PROMPT_VERSION,
  parseOpenAIResponse,
} from "./_shared/incident_expert.ts";
import type { SanitizedIncidentContext } from "./_shared/incident_expert.ts";
import {
  EXPLANATION_CODES,
  optionalExplanation,
} from "./_shared/incident_explanation.ts";
import {
  optionalExpertReview,
  validateExpertReview,
} from "./_shared/incident_review.ts";
import {
  getThreeGateReceipt,
  runThreeGateAssessment,
} from "./_shared/incident_three_gate_service.ts";
import type { FullFifo } from "./_shared/incident_full_fifo.ts";
import { providerObservationSink } from "./_shared/provider_observation.ts";
function equal(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(
      `assertion_failed: ${JSON.stringify(a)} != ${JSON.stringify(b)}`,
    );
  }
}
function rejects(fn: () => unknown) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("expected_rejection");
}
const A = "A".repeat(22), B = "B".repeat(22), C = "C".repeat(22);
const context: SanitizedIncidentContext = {
  schema_version: 3,
  privacy_contract_version: 3,
  privacy_identity_version: 1,
  conversation_ref: C,
  conversation_type: "group",
  redaction_manifest: {},
  evidence_segment_refs: [B],
  trigger_segment_ref: B,
  messages: [A, B].map((ref, index) => ({
    segment_ref: ref,
    participant_ref: C,
    sequence: index,
    relative_time_seconds: index,
    sender_role: "peer",
    source_kind: "text",
    capture_sources: [],
    capture_confidence: {
      conversation: 1,
      message: 1,
      sender: 1,
      direction: 1,
    },
    text: "",
  })),
};
const core = {
  outcome: "dismissed",
  primary_category: null,
  secondary_categories: [],
  severity: null,
  urgency: "routine",
  child_role: "unknown",
  pattern: "isolated",
  confidence: 0.9,
  evidence_segment_refs: [B],
};
const explanation = {
  contract_version: "KIPPY_EXPERT_EXPLANATION_V1",
  statements: [{ code: "ORDINARY_CONVERSATION", evidence_segment_refs: [B] }],
};
function provider(payload: unknown) {
  return {
    model: "gpt-5.6-luna",
    status: "completed",
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(payload) }],
    }],
  };
}
function parsed(payload: unknown) {
  return parseOpenAIResponse(provider(payload), context);
}
function review() {
  const { evidence_segment_refs: _refs, ...analysis } = core;
  return {
    contract_version: "KIPPY_EXPERT_REVIEW_V1",
    model_version: "gpt-5.6-luna",
    prompt_version: "kippy-expert-v6",
    analysis: { ...analysis, evidence_indexes: [1] },
    explanation_status: "AVAILABLE",
    explanation: {
      contract_version: "KIPPY_EXPERT_EXPLANATION_V1",
      statements: [{ code: "ORDINARY_CONVERSATION", evidence_indexes: [1] }],
    },
  };
}
Deno.test("new model rationale is separated from unchanged nine-field policy; genuine v5 has no invented rationale", () => {
  const old = parsed(core), next = parsed({ ...core, explanation });
  equal(Object.keys(next.analysis).length, 9);
  equal(next.analysis, old.analysis);
  equal(deriveExpertPolicy(next.analysis), deriveExpertPolicy(old.analysis));
  equal(next.explanation_status, "AVAILABLE");
  equal(next.explanation, explanation);
  equal(old.explanation_status, "NOT_PROVIDED");
  equal(old.explanation, null);
});
Deno.test("malformed, foreign-ref, extra prose and repeated-code explanations never invalidate valid risk decisions", () => {
  const invalid = ["free prose", { ...explanation, text: "not permitted" }, {
    ...explanation,
    statements: [{ code: "UNKNOWN_CODE", evidence_segment_refs: [B] }],
  }, {
    ...explanation,
    statements: [{ code: "ORDINARY_CONVERSATION", evidence_segment_refs: [C] }],
  }, {
    ...explanation,
    statements: [{ code: "ORDINARY_CONVERSATION", evidence_segment_refs: [A] }],
  }, {
    ...explanation,
    statements: [explanation.statements[0], explanation.statements[0]],
  }, {
    ...explanation,
    statements: [{
      code: "ORDINARY_CONVERSATION",
      evidence_segment_refs: [B, B],
    }],
  }, { ...explanation, statements: [] }];
  for (const outcome of ["confirmed", "dismissed", "inconclusive"]) {
    const decision = outcome === "confirmed"
      ? {
        ...core,
        outcome,
        primary_category: "bullying",
        severity: "high",
        child_role: "target",
      }
      : { ...core, outcome };
    const expected = deriveExpertPolicy(parsed(decision).analysis);
    for (const e of invalid) {
      const result = parsed({ ...decision, explanation: e });
      equal(result.explanation_status, "INVALID");
      equal(result.explanation, null);
      equal(deriveExpertPolicy(result.analysis), expected);
    }
    equal(
      parsed({ ...decision, explanation: null }).explanation_status,
      "NOT_PROVIDED",
    );
  }
  rejects(() => parsed({ ...core, confidence: 0.2, explanation }));
  rejects(() => parsed({ ...core, unexplained_core_field: true, explanation }));
});
Deno.test("all fourteen frozen codes validate; statement bounds and snapshot membership are enforced", () => {
  equal(EXPLANATION_CODES.length, 14);
  for (const code of EXPLANATION_CODES) {
    equal(
      optionalExplanation(
        { ...explanation, statements: [{ code, evidence_segment_refs: [B] }] },
        [B],
        [A, B],
      ).explanation_status,
      "AVAILABLE",
    );
  }
  equal(
    optionalExplanation(explanation, [B], [A]).explanation_status,
    "INVALID",
  );
  equal(
    optionalExplanation(
      {
        ...explanation,
        statements: EXPLANATION_CODES.slice(0, 4).map((code) => ({
          code,
          evidence_segment_refs: [B],
        })),
      },
      [B],
      [B],
    ).explanation_status,
    "INVALID",
  );
});
Deno.test("wire review is zero-based and cannot contain reference keys, prose, out-of-range or unbound indexes", async () => {
  equal(validateExpertReview(review(), 2), review());
  for (const indexes of [[2], [-1], [1, 1], [0.5], []]) {
    const v = review();
    v.analysis.evidence_indexes = indexes;
    equal(validateExpertReview(v, 2), null);
  }
  const foreign = review();
  foreign.explanation.statements[0].evidence_indexes = [0];
  equal(validateExpertReview(foreign, 2), null);
  equal(
    validateExpertReview({
      ...review(),
      explanation_status: "NOT_PROVIDED",
      explanation: null,
    }, 2)?.explanation_status,
    "NOT_PROVIDED",
  );
  equal(
    validateExpertReview({
      ...review(),
      explanation_status: "INVALID",
      explanation: null,
    }, 2)?.explanation_status,
    "INVALID",
  );
  equal(validateExpertReview({ ...review(), text: "not permitted" }, 2), null);
  equal(
    validateExpertReview(
      { ...review(), prompt_version: ["kippy-expert-v6"] },
      2,
    ),
    null,
  );
  equal(
    validateExpertReview({
      ...review(),
      analysis: { ...review().analysis, outcome: ["dismissed"] },
    }, 2),
    null,
  );
  equal(
    await optionalExpertReview(
      () => Promise.reject(new Error("optional_failure")),
      2,
    ),
    null,
  );
});
Deno.test("cached submit and authenticated receipt reconciliation do not rerun inference", async () => {
  const caseId = "12345678-1234-4234-8234-123456789012",
    assessmentId = "12345678-1234-4234-8234-123456789013";
  const metadata = {
    case_id: caseId,
    assessment_id: assessmentId,
    assessment_seq: 1,
    payload_digest: "a".repeat(64),
    snapshot: { message_count: 2 },
  } as FullFifo;
  let calls = 0;
  const receipt = await runThreeGateAssessment(
    {
      incident_id: assessmentId,
      created: false,
      analysis_state: "completed",
      analysis_outcome: "dismissed",
      delivery_count: 0,
    },
    metadata,
    {
      analyze: () => {
        calls++;
        throw new Error("no_replay");
      },
      finalize: () => {
        throw new Error("no_replay");
      },
    },
  );
  equal(calls, 0);
  equal(receipt.expert_outcome, "dismissed");
  const restored = await getThreeGateReceipt({
    operation: "get_assessment_receipt",
    case_id: caseId,
    assessment_id: assessmentId,
    assessment_seq: 1,
  }, async () => ({ ...receipt, receipt_state: "completed" }));
  equal(restored.payload_digest, metadata.payload_digest);
  const extension = await optionalExpertReview(async () => review(), 2);
  equal(extension, review());
  equal(calls, 0);
});
Deno.test("request identifies truthful v6 and never stores provider responses", () => {
  equal(EXPERT_PROMPT_VERSION, "kippy-expert-v6");
  const request = buildOpenAIRequest(context, "kippy_v1_" + "a".repeat(43));
  equal(request.store, false);
});
Deno.test("provider observation records the same prompt version without any model output", async () => {
  let capturedName: string | undefined;
  let captured: Record<string, unknown> = {};
  const sink = providerObservationSink(
    async (name, args) => {
      capturedName = name;
      captured = args;
      return { error: null };
    },
    "12345678-1234-4234-8234-123456789013",
    "a".repeat(64),
    "ephemeral_v3",
  );
  await sink({
    status: "completed",
    http_status: 200,
    latency_ms: 20,
    input_tokens: 10,
    cached_input_tokens: 0,
    output_tokens: 5,
    reasoning_tokens: 1,
  });
  equal(capturedName, "v2_record_expert_provider_attempt_v2_service");
  equal(captured.target_prompt_version, EXPERT_PROMPT_VERSION);
  equal(Object.keys(captured).length, 12);
  equal(Object.hasOwn(captured, "analysis"), false);
  equal(Object.hasOwn(captured, "explanation"), false);
});
