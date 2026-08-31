import { serviceClient } from "../_shared/auth.ts";
import {
  IncidentClaimError,
  normalizeIncidentClaim,
} from "../_shared/incident_claim.ts";
import type { ClaimedIncident } from "../_shared/incident_claim.ts";
import {
  decryptIncidentContext,
  IncidentCryptoError,
} from "../_shared/incident_crypto.ts";
import {
  AnalysisDeadlineError,
  assertAnalysisDeadline,
} from "../_shared/incident_deadline.ts";
import {
  assertIncidentContextBinding,
  callOpenAIExpert,
  deriveExpertPolicy,
  ExpertAnalysisError,
  parseSanitizedIncidentContext,
} from "../_shared/incident_expert_v4.ts";
import {
  classifyFinalizeResponseShapeMismatch,
  classifyFinalizeRpcError,
  classifyIncidentCryptoErrorCode,
  classifyUnexpectedAnalyzerError,
} from "../_shared/incident_failure.ts";
import type { AnalysisFailureClass } from "../_shared/incident_failure.ts";
import { jsonResponse } from "../_shared/http.ts";
import {
  IncidentPrivateKeyConfigError,
  readIncidentPrivateKey,
} from "../_shared/incident_private_key.ts";
import {
  deriveOpenAISafetyIdentifier,
  readOpenAISafetyIdentifierConfig,
  SafetyIdentifierError,
} from "../_shared/incident_safety_identifier.ts";
import { isOpenAIDataRetentionPolicyAcknowledged } from "../_shared/incident_retention_policy.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }
  if (Deno.env.get("KIPPY_EXPERT_ANALYZER_ENABLED") !== "true") {
    return jsonResponse(503, { error: "expert_analyzer_disabled" });
  }
  if (
    !isOpenAIDataRetentionPolicyAcknowledged(
      Deno.env.get("KIPPY_OPENAI_ZDR_APPROVED"),
      Deno.env.get("KIPPY_OPENAI_STANDARD_RETENTION_ACKNOWLEDGED"),
    )
  ) {
    return jsonResponse(503, {
      error: "openai_data_retention_acknowledgement_required",
    });
  }

  const triggerToken = request.headers.get("x-kippy-analyzer-token") ?? "";
  const configuredTriggerToken = Deno.env.get("KIPPY_ANALYZER_TRIGGER_TOKEN") ??
    "";
  if (
    triggerToken.length < 32 ||
    triggerToken.length > 256 ||
    configuredTriggerToken.length < 32 ||
    !constantTimeEqual(triggerToken, configuredTriggerToken)
  ) {
    return jsonResponse(401, { error: "invalid_analyzer_trigger" });
  }

  const databaseCapabilityToken =
    Deno.env.get("KIPPY_ANALYZER_DB_CAPABILITY_TOKEN") ?? "";
  if (
    databaseCapabilityToken.length < 32 ||
    databaseCapabilityToken.length > 256
  ) {
    return jsonResponse(503, {
      error: "expert_configuration_incomplete",
    });
  }

  const openAiKey = Deno.env.get("OPEN_AI_KEY") ?? "";
  if (openAiKey.length < 20) {
    return jsonResponse(503, { error: "expert_configuration_incomplete" });
  }
  let safetyIdentifierConfig: ReturnType<
    typeof readOpenAISafetyIdentifierConfig
  >;
  try {
    safetyIdentifierConfig = readOpenAISafetyIdentifierConfig();
  } catch {
    return jsonResponse(503, { error: "expert_configuration_incomplete" });
  }

  const client = serviceClient();
  const workerId = crypto.randomUUID();
  let claim: ClaimedIncident | undefined;
  let plaintext: Uint8Array | undefined;
  try {
    const { data, error } = await client.rpc(
      "v2_claim_incident_analysis_service",
      {
        target_capability_token: databaseCapabilityToken,
        target_worker_id: workerId,
        target_lease_seconds: 120,
      },
    );
    if (error) {
      throw new ExpertAnalysisError(
        "analysis_claim_failed",
        true,
        "worker_transient",
      );
    }
    if (!Array.isArray(data) || data.length === 0) {
      return jsonResponse(200, { processed: false, reason: "no_work" });
    }
    claim = normalizeIncidentClaim(data[0]);
    const safetyIdentifier = await deriveOpenAISafetyIdentifier(
      claim.child_id,
      safetyIdentifierConfig,
    );

    let privateKey: string;
    try {
      privateKey = readIncidentPrivateKey(claim.key_version);
    } catch (error) {
      const code = error instanceof IncidentPrivateKeyConfigError
        ? error.code
        : "incident_private_key_unavailable";
      throw new ExpertAnalysisError(
        code,
        true,
        "configuration",
      );
    }

    assertAnalysisDeadline(claim, "before_decrypt");
    plaintext = await decryptIncidentContext(
      claim,
      privateKey,
    );
    const context = parseSanitizedIncidentContext(
      plaintext,
      claim.message_count,
    );
    assertIncidentContextBinding(
      context,
      claim.privacy_contract_version,
      claim.privacy_identity_version,
    );
    assertAnalysisDeadline(claim, "before_openai");
    const result = await callOpenAIExpert(
      context,
      openAiKey,
      safetyIdentifier,
    );
    const analysis = result.analysis;
    const policy = deriveExpertPolicy(analysis);
    if (
      !policy.finalizable ||
      policy.needs_fallback ||
      policy.outcome === null ||
      policy.reason_code === null ||
      policy.action_code === null
    ) {
      throw new ExpertAnalysisError(
        "expert_inconclusive",
        true,
        "analysis",
      );
    }

    assertAnalysisDeadline(claim, "before_finalize");
    const { data: finalized, error: finalizeError } = await client.rpc(
      "v2_finalize_incident_analysis_service",
      {
        target_capability_token: databaseCapabilityToken,
        target_worker_id: workerId,
        target_lease_token: claim.lease_token,
        target_incident_id: claim.incident_id,
        target_outcome: policy.outcome,
        target_reason_code: policy.reason_code,
        target_action_code: policy.action_code,
        target_model_version: result.modelVersion,
        target_expert_category: analysis.primary_category,
        target_secondary_categories: analysis.secondary_categories,
        target_expert_severity: analysis.severity,
        target_expert_urgency: analysis.urgency,
        target_expert_child_role: analysis.child_role,
        target_expert_pattern: analysis.pattern,
        target_expert_confidence: analysis.confidence,
        target_evidence_segment_refs: analysis.evidence_segment_refs,
        target_policy_channels: policy.channels,
      },
    );
    if (finalizeError) {
      const failure = classifyFinalizeRpcError(finalizeError);
      throw new ExpertAnalysisError(
        failure.code,
        failure.retryable,
        failure.failureClass,
      );
    }
    if (!Array.isArray(finalized) || finalized.length !== 1) {
      const failure = classifyFinalizeResponseShapeMismatch();
      throw new ExpertAnalysisError(
        failure.code,
        failure.retryable,
        failure.failureClass,
      );
    }

    return jsonResponse(200, {
      processed: true,
      outcome: policy.outcome,
      parent_alert_created: Number(finalized[0].delivery_count ?? 0) > 0,
    });
  } catch (error) {
    const failure = classifyFailure(error);
    if (claim !== undefined) {
      const { error: recordError } = await client.rpc(
        "v2_record_incident_analysis_failure_service",
        {
          target_capability_token: databaseCapabilityToken,
          target_worker_id: workerId,
          target_lease_token: claim.lease_token,
          target_incident_id: claim.incident_id,
          target_error_code: failure.code,
          target_failure_class: failure.failureClass,
          target_retryable: failure.retryable,
        },
      );
      if (recordError) {
        console.error("analysis_failure_record_failed", {
          code: failure.code,
        });
      }
    }
    console.error("expert_analysis_failed", {
      code: failure.code,
      retryable: failure.retryable,
      failure_class: failure.failureClass,
    });
    return jsonResponse(failure.retryable ? 503 : 422, {
      error: failure.code,
      retryable: failure.retryable,
    });
  } finally {
    plaintext?.fill(0);
  }
});

function classifyFailure(error: unknown): {
  code: string;
  retryable: boolean;
  failureClass: AnalysisFailureClass;
} {
  if (error instanceof ExpertAnalysisError) {
    return {
      code: error.code,
      retryable: error.retryable,
      failureClass: error.failureClass,
    };
  }
  if (
    error instanceof IncidentClaimError ||
    error instanceof AnalysisDeadlineError ||
    error instanceof SafetyIdentifierError
  ) {
    return {
      code: error.code,
      retryable: error.retryable,
      failureClass: error.failureClass,
    };
  }
  if (error instanceof IncidentCryptoError) {
    const failure = classifyIncidentCryptoErrorCode(error.code);
    return {
      code: error.code,
      retryable: failure.retryable,
      failureClass: failure.failureClass,
    };
  }
  const failure = classifyUnexpectedAnalyzerError();
  return {
    code: "unexpected_analyzer_error",
    retryable: failure.retryable,
    failureClass: failure.failureClass,
  };
}

function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  leftBytes.fill(0);
  rightBytes.fill(0);
  return difference === 0;
}
