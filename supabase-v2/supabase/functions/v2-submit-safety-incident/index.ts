import {
  isUuid,
  requireDevice,
  requiredString,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import {
  decryptIncidentContext,
  IncidentCryptoError,
  MAX_ENCRYPTED_PAYLOAD_BASE64_CHARS,
  MAX_INCIDENT_SUBMISSION_REQUEST_BYTES,
  validateSubmittedEnvelope,
} from "../_shared/incident_crypto.ts";
import type { ClaimedIncidentEnvelope } from "../_shared/incident_crypto.ts";
import {
  assertIncidentContextBinding,
  callOpenAIExpert,
  deriveExpertPolicy,
  EXPERT_PROMPT_VERSION,
  ExpertAnalysisError,
  parseSanitizedIncidentContext,
} from "../_shared/incident_expert.ts";
import {
  IncidentPrivateKeyConfigError,
  readIncidentPrivateKey,
} from "../_shared/incident_private_key.ts";
import { isOpenAIDataRetentionPolicyAcknowledged } from "../_shared/incident_retention_policy.ts";
import {
  deriveOpenAISafetyIdentifier,
  readOpenAISafetyIdentifierConfig,
  SafetyIdentifierError,
} from "../_shared/incident_safety_identifier.ts";
import {
  isCanonicalIncidentTimestamp,
  isCanonicalIncidentUuid,
} from "../_shared/incident_submission.ts";

const categories = new Set([
  "bullying",
  "exclusion",
  "sexual_content",
  "violence",
  "grooming",
  "manipulation",
  "stranger_contact",
  "self_harm",
  "other",
]);
const severities = new Set(["low", "medium", "high", "critical"]);
const childRoles = new Set(["target", "participant", "initiator", "unknown"]);

Deno.serve(async (request) => {
  try {
    const client = serviceClient();
    const device = await requireDevice(request, client);
    const body = await readJsonObject(
      request,
      MAX_INCIDENT_SUBMISSION_REQUEST_BYTES,
    );
    if (
      !isCanonicalIncidentUuid(body.client_incident_id) ||
      !isUuid(
        request.headers.get("x-kippy-device-id"),
      ) ||
      typeof body.category !== "string" ||
      !categories.has(body.category) ||
      typeof body.severity !== "string" ||
      !severities.has(body.severity) ||
      typeof body.child_role !== "string" ||
      !childRoles.has(body.child_role)
    ) {
      throw new HttpError(400, "invalid_incident_header");
    }

    const confidence = body.confidence;
    const captureQuality = body.capture_quality;
    const sourcePlatform = body.source_platform;
    const contractVersion = body.model_contract_version;
    const aadVersion = body.aad_version;
    const keyVersion = body.key_version;
    const messageCount = body.message_count;
    const privacyContractVersion = body.privacy_contract_version;
    const privacyIdentityVersion = body.privacy_identity_version;
    if (
      typeof confidence !== "number" ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      typeof captureQuality !== "number" ||
      !Number.isFinite(captureQuality) ||
      captureQuality < 0 ||
      captureQuality > 1 ||
      sourcePlatform !== "whatsapp" ||
      contractVersion !== 2 ||
      aadVersion !== 3 ||
      typeof keyVersion !== "number" ||
      !Number.isInteger(keyVersion) ||
      keyVersion < 1 ||
      typeof messageCount !== "number" ||
      !Number.isInteger(messageCount) ||
      messageCount < 1 ||
      messageCount > 60 ||
      typeof privacyContractVersion !== "number" ||
      !Number.isInteger(privacyContractVersion) ||
      privacyContractVersion !== 3 ||
      typeof privacyIdentityVersion !== "number" ||
      !Number.isSafeInteger(privacyIdentityVersion) ||
      privacyIdentityVersion < 1
    ) {
      throw new HttpError(400, "invalid_incident_metrics");
    }

    if (
      !isCanonicalIncidentTimestamp(body.occurred_at) ||
      !isCanonicalIncidentTimestamp(body.context_expires_at)
    ) {
      throw new HttpError(400, "invalid_incident_time");
    }

    const encryptedPayload = requiredString(
      body.encrypted_payload_base64,
      "invalid_encrypted_payload",
      MAX_ENCRYPTED_PAYLOAD_BASE64_CHARS,
    );
    const encryptionAlgorithm = requiredString(
      body.encryption_algorithm,
      "invalid_encryption_algorithm",
      40,
    );
    try {
      validateSubmittedEnvelope(encryptedPayload, {
        aadVersion,
        privacyContractVersion,
        privacyIdentityVersion,
        keyVersion,
        algorithm: encryptionAlgorithm,
      });
    } catch (error) {
      if (error instanceof IncidentCryptoError) {
        throw new HttpError(400, error.code);
      }
      throw error;
    }

    return await processEphemeralExpertIncident({
      body,
      client,
      device,
      confidence,
      captureQuality,
      contractVersion,
      aadVersion,
      keyVersion,
      messageCount,
      privacyContractVersion,
      privacyIdentityVersion,
      encryptedPayload,
      encryptionAlgorithm,
    });
  } catch (error) {
    return handleError(error);
  }
});

interface EphemeralIncidentInput {
  body: Record<string, unknown>;
  client: ReturnType<typeof serviceClient>;
  device: { deviceId: string; childId: string };
  confidence: number;
  captureQuality: number;
  contractVersion: number;
  aadVersion: number;
  keyVersion: number;
  messageCount: number;
  privacyContractVersion: number;
  privacyIdentityVersion: number;
  encryptedPayload: string;
  encryptionAlgorithm: string;
}

async function processEphemeralExpertIncident(
  input: EphemeralIncidentInput,
): Promise<Response> {
  if (Deno.env.get("KIPPY_EXPERT_ANALYZER_ENABLED") !== "true") {
    throw new HttpError(503, "expert_analyzer_disabled");
  }
  if (
    !isOpenAIDataRetentionPolicyAcknowledged(
      Deno.env.get("KIPPY_OPENAI_ZDR_APPROVED"),
      Deno.env.get("KIPPY_OPENAI_STANDARD_RETENTION_ACKNOWLEDGED"),
    )
  ) {
    throw new HttpError(
      503,
      "openai_data_retention_acknowledgement_required",
    );
  }

  const openAiKey = Deno.env.get("OPEN_AI_KEY") ?? "";
  if (openAiKey.length < 20 || openAiKey.length > 512) {
    throw new HttpError(503, "expert_configuration_incomplete");
  }

  let privateKey: string;
  let safetyIdentifierConfig: ReturnType<
    typeof readOpenAISafetyIdentifierConfig
  >;
  try {
    privateKey = readIncidentPrivateKey(input.keyVersion);
    safetyIdentifierConfig = readOpenAISafetyIdentifierConfig();
  } catch (error) {
    if (
      error instanceof IncidentPrivateKeyConfigError ||
      error instanceof SafetyIdentifierError
    ) {
      throw new HttpError(503, "expert_configuration_incomplete");
    }
    throw error;
  }

  const claim: ClaimedIncidentEnvelope = {
    client_incident_id: String(input.body.client_incident_id),
    device_id: input.device.deviceId,
    category: String(input.body.category),
    severity: String(input.body.severity),
    child_role: String(input.body.child_role),
    confidence_canonical: input.confidence.toFixed(6),
    capture_quality_canonical: input.captureQuality.toFixed(6),
    occurred_at_canonical: String(input.body.occurred_at),
    model_contract_version: input.contractVersion,
    privacy_contract_version: input.privacyContractVersion,
    privacy_identity_version: input.privacyIdentityVersion,
    aad_version: input.aadVersion,
    encryption_algorithm: input.encryptionAlgorithm,
    key_version: input.keyVersion,
    message_count: input.messageCount,
    context_expires_at_canonical: String(input.body.context_expires_at),
    encrypted_payload_base64: input.encryptedPayload,
  };

  let plaintext: Uint8Array | undefined;
  let incidentId: string | undefined;
  let leaseToken: string | undefined;
  try {
    plaintext = await decryptIncidentContext(claim, privateKey);
    const context = parseSanitizedIncidentContext(
      plaintext,
      input.messageCount,
    );
    assertIncidentContextBinding(
      context,
      3,
      input.privacyIdentityVersion,
    );

    const submissionHash = await sha256Hex(input.encryptedPayload);
    const { data: begun, error: beginError } = await input.client.rpc(
      "v2_begin_ephemeral_incident_analysis_service",
      {
        target_device_id: input.device.deviceId,
        target_client_incident_id: input.body.client_incident_id,
        target_category: input.body.category,
        target_severity: input.body.severity,
        target_child_role: input.body.child_role,
        target_confidence: input.confidence,
        target_capture_quality: input.captureQuality,
        target_occurred_at: input.body.occurred_at,
        target_model_contract_version: input.contractVersion,
        target_privacy_contract_version: 3,
        target_privacy_identity_version: input.privacyIdentityVersion,
        target_key_version: input.keyVersion,
        target_message_count: input.messageCount,
        target_context_expires_at: input.body.context_expires_at,
        target_submission_hash_hex: submissionHash,
        target_lease_seconds: 120,
      },
    );
    if (beginError?.code === "23505") {
      throw new HttpError(409, "incident_idempotency_conflict");
    }
    if (beginError) throw beginError;
    const begin = Array.isArray(begun) ? begun[0] : undefined;
    if (begin === undefined || typeof begin.incident_id !== "string") {
      throw new Error("missing_ephemeral_incident_result");
    }
    incidentId = begin.incident_id;
    if (begin.analysis_state === "completed") {
      return jsonResponse(200, {
        incident_id: incidentId,
        created: false,
        analysis_outcome: begin.analysis_outcome,
        parent_alert_created: Number(begin.delivery_count ?? 0) > 0,
      });
    }
    if (begin.analysis_state === "busy") {
      throw new HttpError(425, "incident_analysis_in_progress");
    }
    if (
      begin.analysis_state !== "leased" ||
      typeof begin.lease_token !== "string" ||
      begin.lease_token.length !== 64
    ) {
      throw new Error("invalid_ephemeral_analysis_lease");
    }
    leaseToken = begin.lease_token;

    const safetyIdentifier = await deriveOpenAISafetyIdentifier(
      input.device.childId,
      safetyIdentifierConfig,
    );
    const modelResult = await callOpenAIExpert(
      context,
      openAiKey,
      safetyIdentifier,
    );
    const analysis = modelResult.analysis;
    const policy = deriveExpertPolicy(analysis);
    if (
      !policy.finalizable ||
      policy.needs_fallback ||
      policy.outcome === null ||
      policy.reason_code === null ||
      policy.action_code === null
    ) {
      throw new ExpertAnalysisError("expert_inconclusive", true);
    }

    const { data: finalized, error: finalizeError } = await input.client.rpc(
      "v2_finalize_ephemeral_incident_analysis_service",
      {
        target_incident_id: incidentId,
        target_lease_token: leaseToken,
        target_outcome: policy.outcome,
        target_reason_code: policy.reason_code,
        target_action_code: policy.action_code,
        target_model_version: modelResult.modelVersion,
        target_expert_category: analysis.primary_category,
        target_secondary_categories: analysis.secondary_categories,
        target_expert_severity: analysis.severity,
        target_expert_urgency: analysis.urgency,
        target_expert_child_role: analysis.child_role,
        target_expert_pattern: analysis.pattern,
        target_expert_confidence: analysis.confidence,
        target_evidence_segment_refs: analysis.evidence_segment_refs,
        target_policy_channels: policy.channels,
        target_prompt_version: EXPERT_PROMPT_VERSION,
      },
    );
    if (finalizeError) throw finalizeError;
    const result = Array.isArray(finalized) ? finalized[0] : undefined;
    if (result === undefined) {
      throw new Error("missing_ephemeral_finalize_result");
    }
    leaseToken = undefined;
    return jsonResponse(begin.created ? 201 : 200, {
      incident_id: incidentId,
      created: Boolean(begin.created),
      analysis_outcome: result.analysis_outcome,
      parent_alert_created: Number(result.delivery_count ?? 0) > 0,
    });
  } catch (error) {
    if (incidentId !== undefined && leaseToken !== undefined) {
      const { error: releaseError } = await input.client.rpc(
        "v2_release_ephemeral_incident_analysis_service",
        {
          target_incident_id: incidentId,
          target_lease_token: leaseToken,
        },
      );
      if (releaseError) {
        console.error("ephemeral_analysis_lease_release_failed");
      }
    }
    if (error instanceof HttpError) throw error;
    if (error instanceof IncidentCryptoError) {
      throw new HttpError(400, error.code);
    }
    if (error instanceof ExpertAnalysisError) {
      throw new HttpError(error.retryable ? 503 : 422, error.code);
    }
    if (error instanceof SafetyIdentifierError) {
      throw new HttpError(503, "expert_configuration_incomplete");
    }
    throw error;
  } finally {
    plaintext?.fill(0);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  try {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes),
    );
    try {
      return Array.from(digest)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    } finally {
      digest.fill(0);
    }
  } finally {
    bytes.fill(0);
  }
}
