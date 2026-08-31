const ENCRYPTION_ALGORITHM = "RSA-OAEP-3072-SHA256+AES-256-GCM";
const ENVELOPE_VERSION = 1;
const AAD_VERSION = 1;
const PURPOSE = "voice_asr";
export const MAX_VOICE_ASR_PLAINTEXT_BYTES = 4 * 1024 * 1024;
const MAX_CIPHERTEXT_BYTES = MAX_VOICE_ASR_PLAINTEXT_BYTES + 16;
const MAX_ENVELOPE_METADATA_BYTES = 4 * 1024;
export const MAX_VOICE_ASR_ENVELOPE_BYTES =
  maxBase64Length(MAX_CIPHERTEXT_BYTES) + MAX_ENVELOPE_METADATA_BYTES;
export const MAX_VOICE_ASR_ENVELOPE_BASE64_CHARS = maxBase64Length(
  MAX_VOICE_ASR_ENVELOPE_BYTES,
);
export const MAX_VOICE_ASR_REQUEST_BYTES = MAX_VOICE_ASR_ENVELOPE_BASE64_CHARS +
  64 * 1024;

export interface VoiceAsrClaim {
  request_id: string;
  device_id: string;
  key_version: number;
  encryption_algorithm: string;
  aad_version: number;
  model_contract_version: number;
  audio_duration_ms: number;
  audio_mime_type: string;
  model: string;
  expires_at: string;
  max_processing_ms: number;
  encrypted_payload_base64: string;
}

interface VoiceAsrEnvelope {
  envelope_version: number;
  aad_version: number;
  purpose: string;
  key_version: number;
  algorithm: string;
  nonce_base64: string;
  wrapped_key_base64: string;
  ciphertext_base64: string;
}

export class VoiceAsrCryptoError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function validateVoiceAsrClaim(
  claim: VoiceAsrClaim,
  nowMs: number,
): void {
  if (
    !isUuid(claim.request_id) ||
    !isUuid(claim.device_id) ||
    claim.key_version < 1 ||
    !Number.isSafeInteger(claim.key_version) ||
    claim.encryption_algorithm !== ENCRYPTION_ALGORITHM ||
    claim.aad_version !== AAD_VERSION ||
    claim.model_contract_version !== 1 ||
    !Number.isSafeInteger(claim.audio_duration_ms) ||
    claim.audio_duration_ms < 1 ||
    claim.audio_duration_ms > 120_000 ||
    claim.audio_mime_type !== "audio/wav" ||
    claim.model !== "gpt-4o-mini-transcribe" ||
    claim.max_processing_ms !== maximumProcessingMs(claim.audio_duration_ms) ||
    !isCanonicalTimestamp(claim.expires_at)
  ) {
    throw new VoiceAsrCryptoError("invalid_voice_asr_header");
  }
  const expiryMs = Date.parse(claim.expires_at);
  if (expiryMs <= nowMs || expiryMs > nowMs + 5 * 60_000) {
    throw new VoiceAsrCryptoError("invalid_voice_asr_expiry");
  }
  validateSubmittedVoiceAsrEnvelope(claim);
}

export async function decryptVoiceAsrAudio(
  claim: VoiceAsrClaim,
  privateKeyPem: string,
): Promise<Uint8Array> {
  const envelopeBytes = decodeBase64(
    claim.encrypted_payload_base64,
    MAX_VOICE_ASR_ENVELOPE_BYTES,
    "invalid_voice_asr_envelope",
  );
  let contentKeyBytes: Uint8Array | undefined;
  let aadBytes: Uint8Array | undefined;
  try {
    const envelope = parseEnvelope(envelopeBytes);
    validateEnvelopeMatchesClaim(envelope, claim);
    const wrappedKey = decodeBase64(
      envelope.wrapped_key_base64,
      384,
      "invalid_voice_asr_wrapped_key",
    );
    const nonce = decodeBase64(
      envelope.nonce_base64,
      12,
      "invalid_voice_asr_nonce",
    );
    const ciphertext = decodeBase64(
      envelope.ciphertext_base64,
      MAX_CIPHERTEXT_BYTES,
      "invalid_voice_asr_ciphertext",
    );
    try {
      if (
        wrappedKey.byteLength !== 384 ||
        nonce.byteLength !== 12 ||
        ciphertext.byteLength < 17
      ) {
        throw new VoiceAsrCryptoError("invalid_voice_asr_envelope");
      }
      const privateKey = await importPrivateKey(privateKeyPem);
      try {
        contentKeyBytes = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            cryptoBytes(wrappedKey),
          ),
        );
      } catch {
        throw new VoiceAsrCryptoError("voice_asr_key_unwrap_failed");
      }
      if (contentKeyBytes.byteLength !== 32) {
        throw new VoiceAsrCryptoError("invalid_voice_asr_content_key");
      }
      const contentKey = await crypto.subtle.importKey(
        "raw",
        cryptoBytes(contentKeyBytes),
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"],
      );
      aadBytes = canonicalVoiceAsrAadBytes(claim);
      try {
        return new Uint8Array(
          await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: cryptoBytes(nonce),
              additionalData: cryptoBytes(aadBytes),
              tagLength: 128,
            },
            contentKey,
            cryptoBytes(ciphertext),
          ),
        );
      } catch {
        throw new VoiceAsrCryptoError("voice_asr_payload_auth_failed");
      }
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

export function canonicalVoiceAsrAadBytes(
  claim: VoiceAsrClaim,
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    aad_version: AAD_VERSION,
    purpose: PURPOSE,
    request_id: claim.request_id,
    device_id: claim.device_id,
    key_version: claim.key_version,
    algorithm: claim.encryption_algorithm,
    audio_duration_ms: claim.audio_duration_ms,
    audio_mime_type: claim.audio_mime_type,
    model: claim.model,
    expires_at: claim.expires_at,
    max_processing_ms: claim.max_processing_ms,
  }));
}

export function maximumProcessingMs(durationMs: number): number {
  if (!Number.isSafeInteger(durationMs) || durationMs < 1) {
    throw new VoiceAsrCryptoError("invalid_voice_asr_duration");
  }
  return Math.ceil(durationMs * 1.5);
}

function validateSubmittedVoiceAsrEnvelope(claim: VoiceAsrClaim): void {
  const bytes = decodeBase64(
    claim.encrypted_payload_base64,
    MAX_VOICE_ASR_ENVELOPE_BYTES,
    "invalid_voice_asr_envelope",
  );
  try {
    validateEnvelopeMatchesClaim(parseEnvelope(bytes), claim);
  } finally {
    bytes.fill(0);
  }
}

function validateEnvelopeMatchesClaim(
  envelope: VoiceAsrEnvelope,
  claim: VoiceAsrClaim,
): void {
  if (
    envelope.envelope_version !== ENVELOPE_VERSION ||
    envelope.aad_version !== AAD_VERSION ||
    envelope.purpose !== PURPOSE ||
    envelope.key_version !== claim.key_version ||
    envelope.algorithm !== claim.encryption_algorithm
  ) {
    throw new VoiceAsrCryptoError("voice_asr_envelope_header_mismatch");
  }
}

function parseEnvelope(bytes: Uint8Array): VoiceAsrEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new VoiceAsrCryptoError("invalid_voice_asr_envelope");
  }
  const keys = [
    "envelope_version",
    "aad_version",
    "purpose",
    "key_version",
    "algorithm",
    "nonce_base64",
    "wrapped_key_base64",
    "ciphertext_base64",
  ];
  if (!isRecord(value) || !hasExactKeys(value, keys)) {
    throw new VoiceAsrCryptoError("invalid_voice_asr_envelope");
  }
  const envelope = value as unknown as VoiceAsrEnvelope;
  if (
    !Number.isInteger(envelope.envelope_version) ||
    !Number.isInteger(envelope.aad_version) ||
    !Number.isInteger(envelope.key_version) ||
    typeof envelope.purpose !== "string" ||
    typeof envelope.algorithm !== "string" ||
    typeof envelope.nonce_base64 !== "string" ||
    typeof envelope.wrapped_key_base64 !== "string" ||
    typeof envelope.ciphertext_base64 !== "string"
  ) {
    throw new VoiceAsrCryptoError("invalid_voice_asr_envelope");
  }
  return envelope;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  if (
    !pem.includes("-----BEGIN PRIVATE KEY-----") ||
    !pem.includes("-----END PRIVATE KEY-----")
  ) {
    throw new VoiceAsrCryptoError("invalid_voice_asr_private_key");
  }
  const bytes = decodeBase64(
    pem.replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replaceAll(/\s/g, ""),
    8_192,
    "invalid_voice_asr_private_key",
  );
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      cryptoBytes(bytes),
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );
  } catch {
    throw new VoiceAsrCryptoError("invalid_voice_asr_private_key");
  } finally {
    bytes.fill(0);
  }
}

function decodeBase64(
  value: string,
  maxBytes: number,
  code: string,
): Uint8Array {
  const canonical = value.replaceAll(/\s/g, "");
  if (
    canonical.length === 0 ||
    canonical.length > maxBase64Length(maxBytes) + 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(canonical)
  ) {
    throw new VoiceAsrCryptoError(code);
  }
  let binary: string;
  try {
    binary = atob(canonical);
  } catch {
    throw new VoiceAsrCryptoError(code);
  }
  if (binary.length > maxBytes) throw new VoiceAsrCryptoError(code);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

function cryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!(bytes.buffer instanceof ArrayBuffer)) {
    throw new VoiceAsrCryptoError("unsupported_voice_asr_crypto_buffer");
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

function maxBase64Length(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
