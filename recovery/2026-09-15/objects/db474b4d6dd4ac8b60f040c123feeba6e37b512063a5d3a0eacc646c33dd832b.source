import type { ClaimedIncidentEnvelope } from "./incident_crypto.ts";
import type { AnalysisFailureClass } from "./incident_failure.ts";
import {
  isCanonicalIncidentTimestamp,
  isCanonicalIncidentUuid,
  isStoredIncidentPrivacyContractVersion,
} from "./incident_submission.ts";

export interface ClaimedIncident extends ClaimedIncidentEnvelope {
  incident_id: string;
  child_id: string;
  lease_token: string;
  lease_expires_at_canonical: string;
}

export class IncidentClaimError extends Error {
  readonly code = "invalid_analysis_claim";
  readonly retryable = false;
  readonly failureClass: AnalysisFailureClass = "analysis";

  constructor() {
    super("invalid_analysis_claim");
  }
}

export function normalizeIncidentClaim(value: unknown): ClaimedIncident {
  if (!isRecord(value)) throw new IncidentClaimError();
  const normalized: Record<string, unknown> = { ...value };
  const numberFields = [
    "model_contract_version",
    "privacy_contract_version",
    "privacy_identity_version",
    "aad_version",
    "key_version",
    "message_count",
  ];
  for (const field of numberFields) {
    const numberValue = Number(normalized[field]);
    if (!Number.isSafeInteger(numberValue)) {
      throw new IncidentClaimError();
    }
    normalized[field] = numberValue;
  }

  const requiredStrings = [
    "incident_id",
    "lease_token",
    "client_incident_id",
    "device_id",
    "child_id",
    "category",
    "severity",
    "child_role",
    "confidence_canonical",
    "capture_quality_canonical",
    "occurred_at_canonical",
    "lease_expires_at_canonical",
    "context_expires_at_canonical",
    "encryption_algorithm",
    "encrypted_payload_base64",
  ];
  if (
    requiredStrings.some((field) => typeof normalized[field] !== "string") ||
    !isCanonicalIncidentUuid(normalized.incident_id) ||
    !isCanonicalIncidentUuid(normalized.client_incident_id) ||
    !isCanonicalIncidentUuid(normalized.device_id) ||
    !isCanonicalIncidentUuid(normalized.child_id) ||
    !/^[a-f0-9]{64}$/.test(String(normalized.lease_token)) ||
    !isCanonicalIncidentTimestamp(
      normalized.occurred_at_canonical,
    ) ||
    !isCanonicalIncidentTimestamp(
      normalized.lease_expires_at_canonical,
    ) ||
    !isCanonicalIncidentTimestamp(
      normalized.context_expires_at_canonical,
    ) ||
    !/^(?:0\.[0-9]{6}|1\.000000)$/.test(
      String(normalized.confidence_canonical),
    ) ||
    !/^(?:0\.[0-9]{6}|1\.000000)$/.test(
      String(normalized.capture_quality_canonical),
    ) ||
    normalized.model_contract_version !== 2 ||
    !isStoredIncidentPrivacyContractVersion(
      normalized.privacy_contract_version,
    ) ||
    normalized.aad_version !== 3 ||
    Number(normalized.privacy_identity_version) < 1 ||
    Number(normalized.key_version) < 1 ||
    Number(normalized.message_count) < 1 ||
    Number(normalized.message_count) > 60 ||
    String(normalized.encrypted_payload_base64).length === 0
  ) {
    throw new IncidentClaimError();
  }

  return normalized as unknown as ClaimedIncident;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}
