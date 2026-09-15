import type { ExpertModelResult } from "./incident_expert.ts";
import type { FullFifo } from "./incident_full_fifo.ts";
import { fullFifoReceipt } from "./incident_full_fifo.ts";
import { HttpError } from "./http.ts";
import { isCanonicalIncidentUuid } from "./incident_submission.ts";

export interface ThreeGateBegin {
  incident_id: string;
  created: boolean;
  analysis_state: string;
  lease_token?: string | null;
  analysis_outcome?: string | null;
  delivery_count?: number;
  parent_incident_id?: string | null;
}
export interface ThreeGateCompletion {
  analysis_outcome: string;
  delivery_count: number;
  parent_incident_id?: string | null;
}
/** Both transport replay and new inference use the same terminal outcome contract. */
export async function runThreeGateAssessment(
  begin: ThreeGateBegin,
  metadata: FullFifo,
  work: {
    analyze: () => Promise<ExpertModelResult>;
    finalize: (result: ExpertModelResult) => Promise<ThreeGateCompletion>;
  },
): Promise<Record<string, unknown>> {
  let completion: ThreeGateCompletion;
  if (begin.analysis_state === "completed") {
    completion = {
      analysis_outcome: String(begin.analysis_outcome),
      delivery_count: Number(begin.delivery_count ?? 0),
      parent_incident_id: begin.parent_incident_id,
    };
  } else {
    if (begin.analysis_state === "busy") {
      throw new HttpError(425, "incident_analysis_in_progress");
    }
    if (
      begin.analysis_state !== "leased" ||
      typeof begin.lease_token !== "string" ||
      !/^[0-9a-f]{64}$/.test(begin.lease_token)
    ) throw new Error("invalid_ephemeral_analysis_lease");
    // Inconclusive is persisted exactly once. Provider transport/schema failures
    // throw before finalize and retain the same assessment for a technical retry.
    completion = await work.finalize(await work.analyze());
  }
  if (
    !["confirmed", "dismissed", "inconclusive"].includes(
      completion.analysis_outcome,
    )
  ) {
    throw new Error("invalid_three_gate_completion");
  }
  return {
    incident_id: completion.parent_incident_id ?? begin.incident_id,
    created: begin.analysis_state === "completed"
      ? false
      : Boolean(begin.created),
    analysis_outcome: completion.analysis_outcome,
    parent_alert_created: completion.delivery_count > 0,
    ...fullFifoReceipt(metadata, completion.analysis_outcome),
  };
}

/** Authenticated receipt reconciliation accepts no source content or encrypted envelope. */
export async function getThreeGateReceipt(
  body: Record<string, unknown>,
  lookup: (
    caseId: string,
    assessmentId: string,
    sequence: number,
  ) => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  if (
    Object.keys(body).length !== 4 ||
    body.operation !== "get_assessment_receipt" ||
    !isCanonicalIncidentUuid(body.case_id) ||
    !isCanonicalIncidentUuid(body.assessment_id) ||
    !Number.isSafeInteger(body.assessment_seq) ||
    Number(body.assessment_seq) < 1
  ) {
    throw new HttpError(400, "invalid_assessment_receipt_query");
  }
  const result = await lookup(
    String(body.case_id),
    String(body.assessment_id),
    Number(body.assessment_seq),
  );
  if (
    !["completed", "pending", "not_found"].includes(
      String(result.receipt_state),
    )
  ) {
    throw new Error("invalid_assessment_receipt_result");
  }
  if (result.receipt_state !== "completed") {
    // A negative lookup is an observation only, never permission to resend invalid evidence.
    return {
      receipt_state: result.receipt_state,
      case_id: body.case_id,
      assessment_id: body.assessment_id,
      assessment_seq: body.assessment_seq,
    };
  }
  if (
    !isCanonicalIncidentUuid(result.incident_id) ||
    !["confirmed", "dismissed", "inconclusive"].includes(
      String(result.expert_outcome),
    ) ||
    result.analysis_outcome !== result.expert_outcome ||
    result.case_id !== body.case_id ||
    result.assessment_id !== body.assessment_id ||
    Number(result.assessment_seq) !== body.assessment_seq ||
    !Number.isInteger(result.message_count) ||
    Number(result.message_count) < 1 || Number(result.message_count) > 60 ||
    typeof result.payload_digest !== "string" ||
    !/^[0-9a-f]{64}$/.test(result.payload_digest) ||
    typeof result.parent_alert_created !== "boolean"
  ) throw new Error("invalid_assessment_receipt_result");
  return {
    receipt_state: "completed",
    incident_id: result.incident_id,
    created: false,
    analysis_outcome: result.expert_outcome,
    expert_outcome: result.expert_outcome,
    case_id: result.case_id,
    assessment_id: result.assessment_id,
    assessment_seq: Number(result.assessment_seq),
    message_count: Number(result.message_count),
    payload_digest: result.payload_digest,
    parent_alert_created: result.parent_alert_created,
  };
}
