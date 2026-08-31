// V1 is the original sanitized FIFO persisted as an encrypted envelope.
export const LEGACY_STORED_PRIVACY_CONTRACT_VERSION = 1;
// V2 adds bounded, non-identifying safety_context and remains encrypted-at-rest.
export const STORED_SAFETY_CONTEXT_PRIVACY_CONTRACT_VERSION = 2;
// V3 is decrypted and analyzed ephemerally; its payload must never be persisted.
export const EPHEMERAL_PRIVACY_CONTRACT_VERSION = 3;

export type StoredIncidentPrivacyContractVersion = 1 | 2;
export type SupportedIncidentPrivacyContractVersion = 1 | 2 | 3;

export function isStoredIncidentPrivacyContractVersion(
  value: unknown,
): value is StoredIncidentPrivacyContractVersion {
  return value === LEGACY_STORED_PRIVACY_CONTRACT_VERSION ||
    value === STORED_SAFETY_CONTEXT_PRIVACY_CONTRACT_VERSION;
}

export function isSupportedIncidentPrivacyContractVersion(
  value: unknown,
): value is SupportedIncidentPrivacyContractVersion {
  return isStoredIncidentPrivacyContractVersion(value) ||
    value === EPHEMERAL_PRIVACY_CONTRACT_VERSION;
}

export function isCanonicalIncidentUuid(
  value: unknown,
): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(value);
}

export function isCanonicalIncidentTimestamp(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value;
}
