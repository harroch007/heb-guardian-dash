import { isSupportedIncidentPrivacyContractVersion } from "./incident_submission.ts";

const ENCRYPTION_ALGORITHM = "RSA-OAEP-3072-SHA256+AES-256-GCM";
const AAD_VERSION = 3;
const ENVELOPE_VERSION = 2;
export const MAX_INCIDENT_PLAINTEXT_BYTES = 4 * 1024 * 1024;
const AES_GCM_TAG_BYTES = 16;
const MAX_CIPHERTEXT_BYTES = MAX_INCIDENT_PLAINTEXT_BYTES +
  AES_GCM_TAG_BYTES;
const MAX_ENVELOPE_METADATA_BYTES = 4 * 1024;
export const MAX_ENVELOPE_BYTES = maxBase64Length(MAX_CIPHERTEXT_BYTES) +
  MAX_ENVELOPE_METADATA_BYTES;
export const MAX_ENCRYPTED_PAYLOAD_BASE64_CHARS = maxBase64Length(
  MAX_ENVELOPE_BYTES,
);
export const MAX_INCIDENT_SUBMISSION_REQUEST_BYTES =
  MAX_ENCRYPTED_PAYLOAD_BASE64_CHARS + 64 * 1024;

export interface ClaimedIncidentEnvelope {
  client_incident_id: string;
  device_id: string;
  category: string;
  severity: string;
  child_role: string;
  confidence_canonical: string;
  capture_quality_canonical: string;
  occurred_at_canonical: string;
  model_contract_version: number;
  privacy_contract_version: number;
  privacy_identity_version: number;
  aad_version: number;
  encryption_algorithm: string;
  key_version: number;
  message_count: number;
  context_expires_at_canonical: string;
  encrypted_payload_base64: string;
}

interface EncryptedEnvelope {
  envelope_version: number;
  aad_version: number;
  privacy_contract_version: number;
  privacy_identity_version: number;
  key_version: number;
  algorithm: string;
  nonce_base64: string;
  wrapped_key_base64: string;
  ciphertext_base64: string;
}

export class IncidentCryptoError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function decryptIncidentContext(
  claim: ClaimedIncidentEnvelope,
  privateKeyPem: string,
): Promise<Uint8Array> {
  validateClaimCryptographicHeader(claim);
  const envelopeBytes = decodeBase64(
    claim.encrypted_payload_base64,
    MAX_ENVELOPE_BYTES,
    "invalid_encrypted_envelope",
  );
  let contentKeyBytes: Uint8Array | undefined;
  let aadBytes: Uint8Array | undefined;
  try {
    const envelope = parseEnvelope(envelopeBytes);
    validateEnvelopeMatchesClaim(envelope, claim);

    const wrappedKey = decodeBase64(
      envelope.wrapped_key_base64,
      384,
      "invalid_wrapped_key",
    );
    const nonce = decodeBase64(
      envelope.nonce_base64,
      12,
      "invalid_nonce",
    );
    const ciphertext = decodeBase64(
      envelope.ciphertext_base64,
      MAX_CIPHERTEXT_BYTES,
      "invalid_ciphertext",
    );
    if (
      wrappedKey.byteLength !== 384 ||
      nonce.byteLength !== 12 ||
      ciphertext.byteLength < 17
    ) {
      wrappedKey.fill(0);
      nonce.fill(0);
      ciphertext.fill(0);
      throw new IncidentCryptoError("invalid_encrypted_envelope");
    }

    try {
      const privateKey = await importPrivateKey(privateKeyPem);
      let unwrapped: ArrayBuffer;
      try {
        unwrapped = await crypto.subtle.decrypt(
          { name: "RSA-OAEP" },
          privateKey,
          cryptoBytes(wrappedKey),
        );
      } catch {
        throw new IncidentCryptoError("incident_key_unwrap_failed");
      }
      contentKeyBytes = new Uint8Array(unwrapped);
      if (contentKeyBytes.byteLength !== 32) {
        throw new IncidentCryptoError("invalid_content_key");
      }

      const contentKey = await crypto.subtle.importKey(
        "raw",
        cryptoBytes(contentKeyBytes),
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
      aadBytes = canonicalIncidentAadBytes(claim);
      let plaintext: ArrayBuffer;
      try {
        plaintext = await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: cryptoBytes(nonce),
            additionalData: cryptoBytes(aadBytes),
            tagLength: 128,
          },
          contentKey,
          cryptoBytes(ciphertext),
        );
      } catch {
        throw new IncidentCryptoError("incident_payload_auth_failed");
      }
      return new Uint8Array(plaintext);
    } catch (error) {
      if (error instanceof IncidentCryptoError) throw error;
      throw new IncidentCryptoError("incident_decryption_failed");
    } finally {
      wrappedKey.fill(0);
      nonce.fill(0);
      ciphertext.fill(0);
    }
  } finally {
    envelopeBytes.fill(0);
    contentKeyBytes?.fill(0);
    aadBytes?.fill(0);
  }
}

export function validateSubmittedEnvelope(
  encryptedPayloadBase64: string,
  expected: {
    aadVersion: number;
    privacyContractVersion: number;
    privacyIdentityVersion: number;
    keyVersion: number;
    algorithm: string;
  },
): void {
  const envelopeBytes = decodeBase64(
    encryptedPayloadBase64,
    MAX_ENVELOPE_BYTES,
    "invalid_encrypted_payload",
  );
  try {
    const envelope = parseEnvelope(envelopeBytes);
    if (
      envelope.envelope_version !== ENVELOPE_VERSION ||
      envelope.aad_version !== expected.aadVersion ||
      !isSupportedIncidentPrivacyContractVersion(
        expected.privacyContractVersion,
      ) ||
      envelope.privacy_contract_version !==
        expected.privacyContractVersion ||
      envelope.privacy_identity_version !==
        expected.privacyIdentityVersion ||
      envelope.key_version !== expected.keyVersion ||
      envelope.algorithm !== expected.algorithm
    ) {
      throw new IncidentCryptoError("incident_envelope_header_mismatch");
    }
    const nonce = decodeBase64(
      envelope.nonce_base64,
      12,
      "invalid_nonce",
    );
    const wrappedKey = decodeBase64(
      envelope.wrapped_key_base64,
      384,
      "invalid_wrapped_key",
    );
    const ciphertext = decodeBase64(
      envelope.ciphertext_base64,
      MAX_CIPHERTEXT_BYTES,
      "invalid_ciphertext",
    );
    try {
      if (
        nonce.byteLength !== 12 ||
        wrappedKey.byteLength !== 384 ||
        ciphertext.byteLength < 17
      ) {
        throw new IncidentCryptoError("invalid_encrypted_payload");
      }
    } finally {
      nonce.fill(0);
      wrappedKey.fill(0);
      ciphertext.fill(0);
    }
  } finally {
    envelopeBytes.fill(0);
  }
}

function validateClaimCryptographicHeader(
  claim: ClaimedIncidentEnvelope,
): void {
  if (
    claim.aad_version !== AAD_VERSION ||
    claim.model_contract_version !== 2 ||
    claim.encryption_algorithm !== ENCRYPTION_ALGORITHM ||
    !Number.isInteger(claim.key_version) ||
    claim.key_version < 1 ||
    !isSupportedIncidentPrivacyContractVersion(
      claim.privacy_contract_version,
    ) ||
    !Number.isSafeInteger(claim.privacy_identity_version) ||
    claim.privacy_identity_version < 1 ||
    !Number.isInteger(claim.message_count) ||
    claim.message_count < 1 ||
    claim.message_count > 60 ||
    !isUuid(claim.client_incident_id) ||
    !isUuid(claim.device_id) ||
    !isCanonicalProbability(claim.confidence_canonical) ||
    !isCanonicalProbability(claim.capture_quality_canonical) ||
    !isCanonicalTimestamp(claim.occurred_at_canonical) ||
    !isCanonicalTimestamp(claim.context_expires_at_canonical)
  ) {
    throw new IncidentCryptoError("invalid_claim_header");
  }
}

function validateEnvelopeMatchesClaim(
  envelope: EncryptedEnvelope,
  claim: ClaimedIncidentEnvelope,
): void {
  if (
    envelope.envelope_version !== ENVELOPE_VERSION ||
    envelope.aad_version !== AAD_VERSION ||
    envelope.privacy_contract_version !==
      claim.privacy_contract_version ||
    envelope.privacy_identity_version !==
      claim.privacy_identity_version ||
    envelope.key_version !== claim.key_version ||
    envelope.algorithm !== claim.encryption_algorithm
  ) {
    throw new IncidentCryptoError("incident_envelope_header_mismatch");
  }
}

export function canonicalIncidentAadBytes(
  claim: ClaimedIncidentEnvelope,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    aad_version: AAD_VERSION,
    schema_version: claim.model_contract_version,
    privacy_contract_version: claim.privacy_contract_version,
    privacy_identity_version: claim.privacy_identity_version,
    client_incident_id: claim.client_incident_id,
    device_id: claim.device_id,
    key_version: claim.key_version,
    algorithm: claim.encryption_algorithm,
    context_expires_at: claim.context_expires_at_canonical,
    category: claim.category,
    severity: claim.severity,
    child_role: claim.child_role,
    confidence: claim.confidence_canonical,
    capture_quality: claim.capture_quality_canonical,
    occurred_at: claim.occurred_at_canonical,
    message_count: claim.message_count,
  }));
}

function parseEnvelope(bytes: Uint8Array): EncryptedEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new IncidentCryptoError("invalid_encrypted_envelope");
  }
  if (
    !isRecord(parsed) || !hasExactKeys(parsed, [
      "envelope_version",
      "aad_version",
      "privacy_contract_version",
      "privacy_identity_version",
      "key_version",
      "algorithm",
      "nonce_base64",
      "wrapped_key_base64",
      "ciphertext_base64",
    ])
  ) {
    throw new IncidentCryptoError("invalid_encrypted_envelope");
  }
  const envelope = parsed as unknown as EncryptedEnvelope;
  if (
    !Number.isInteger(envelope.envelope_version) ||
    !Number.isInteger(envelope.aad_version) ||
    !Number.isInteger(envelope.privacy_contract_version) ||
    !Number.isSafeInteger(envelope.privacy_identity_version) ||
    !Number.isInteger(envelope.key_version) ||
    typeof envelope.algorithm !== "string" ||
    typeof envelope.nonce_base64 !== "string" ||
    typeof envelope.wrapped_key_base64 !== "string" ||
    typeof envelope.ciphertext_base64 !== "string"
  ) {
    throw new IncidentCryptoError("invalid_encrypted_envelope");
  }
  return envelope;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (
    !pem.includes("-----BEGIN PRIVATE KEY-----") ||
    !pem.includes("-----END PRIVATE KEY-----")
  ) {
    throw new IncidentCryptoError("invalid_private_key");
  }
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll(/\s/g, "");
  const bytes = decodeBase64(body, 8_192, "invalid_private_key");
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      cryptoBytes(bytes),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
  } catch {
    throw new IncidentCryptoError("invalid_private_key");
  } finally {
    bytes.fill(0);
  }
}

function decodeBase64(
  value: string,
  maxBytes: number,
  code: string,
): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new IncidentCryptoError(code);
  }
  const canonical = value.replaceAll(/\s/g, "");
  if (
    canonical.length === 0 ||
    canonical.length > Math.ceil(maxBytes / 3) * 4 + 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(canonical)
  ) {
    throw new IncidentCryptoError(code);
  }
  let binary: string;
  try {
    binary = atob(canonical);
  } catch {
    throw new IncidentCryptoError(code);
  }
  if (binary.length > maxBytes) {
    throw new IncidentCryptoError(code);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function maxBase64Length(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4;
}

function cryptoBytes(
  bytes: Uint8Array,
): Uint8Array<ArrayBuffer> {
  if (!(bytes.buffer instanceof ArrayBuffer)) {
    throw new IncidentCryptoError("unsupported_crypto_buffer");
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    .test(value);
}

function isCanonicalProbability(value: string): boolean {
  return /^(?:0\.[0-9]{6}|1\.000000)$/.test(value);
}

function isCanonicalTimestamp(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value;
}
