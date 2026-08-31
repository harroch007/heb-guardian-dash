import type { AnalysisFailureClass } from "./incident_failure.ts";
import { isCanonicalIncidentUuid } from "./incident_submission.ts";

const KEY_VERSION_ENV = "KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_VERSION";
const KEY_ENV_PREFIX = "KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_V";
const KEY_VERSION_PATTERN = /^[1-9][0-9]{0,3}$/;
const KEY_MATERIAL_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/;
const IDENTIFIER_PATTERN = /^kippy_v[1-9][0-9]{0,3}_[A-Za-z0-9_-]{43}$/;

export interface OpenAISafetyIdentifierConfig {
  readonly keyVersion: number;
  readonly keyMaterial: string;
}

export class SafetyIdentifierError extends Error {
  readonly retryable = true;
  readonly failureClass: AnalysisFailureClass = "configuration";

  constructor(readonly code: string) {
    super(code);
  }
}

export function readOpenAISafetyIdentifierConfig(
  readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name),
): OpenAISafetyIdentifierConfig {
  const versionText = readEnv(KEY_VERSION_ENV) ?? "";
  if (!KEY_VERSION_PATTERN.test(versionText)) {
    throw new SafetyIdentifierError(
      "invalid_safety_identifier_key_version",
    );
  }

  const keyMaterial = readEnv(`${KEY_ENV_PREFIX}${versionText}`) ?? "";
  let keyBytes: Uint8Array<ArrayBuffer> | undefined;
  try {
    keyBytes = decodeKeyMaterial(keyMaterial);
  } catch {
    throw new SafetyIdentifierError(
      "invalid_safety_identifier_key_material",
    );
  } finally {
    keyBytes?.fill(0);
  }

  return {
    keyVersion: Number(versionText),
    keyMaterial,
  };
}

export async function deriveOpenAISafetyIdentifier(
  childId: string,
  config: OpenAISafetyIdentifierConfig,
): Promise<string> {
  if (
    !isCanonicalIncidentUuid(childId) ||
    !Number.isSafeInteger(config.keyVersion) ||
    config.keyVersion < 1 ||
    config.keyVersion > 9_999 ||
    !KEY_MATERIAL_PATTERN.test(config.keyMaterial)
  ) {
    throw new SafetyIdentifierError(
      "invalid_safety_identifier_input",
    );
  }

  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = decodeKeyMaterial(config.keyMaterial);
  } catch {
    throw new SafetyIdentifierError(
      "invalid_safety_identifier_input",
    );
  }
  const scopeBytes = new TextEncoder().encode(
    `kippy/openai-safety-identifier/key-version/${config.keyVersion}` +
      `\nscope/child/${childId}`,
  );
  let signatureBytes: Uint8Array | undefined;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    signatureBytes = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, scopeBytes),
    );
    const identifier = `kippy_v${config.keyVersion}_${
      base64Url(signatureBytes)
    }`;
    if (
      identifier.length > 64 ||
      !IDENTIFIER_PATTERN.test(identifier) ||
      identifier.includes(childId)
    ) {
      throw new SafetyIdentifierError(
        "invalid_safety_identifier_output",
      );
    }
    return identifier;
  } catch (error) {
    if (error instanceof SafetyIdentifierError) throw error;
    throw new SafetyIdentifierError(
      "safety_identifier_derivation_failed",
    );
  } finally {
    keyBytes.fill(0);
    scopeBytes.fill(0);
    signatureBytes?.fill(0);
  }
}

export function isValidOpenAISafetyIdentifier(
  value: string,
): boolean {
  return value.length <= 64 && IDENTIFIER_PATTERN.test(value);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeKeyMaterial(value: string): Uint8Array<ArrayBuffer> {
  if (
    value.length < 43 ||
    value.length > 88 ||
    !KEY_MATERIAL_PATTERN.test(value) ||
    value.length % 4 === 1
  ) {
    throw new Error("invalid_key_encoding");
  }
  const normalized = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .replace(/=+$/u, "");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new Error("invalid_key_encoding");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (bytes.length < 32 || bytes.length > 64) {
    bytes.fill(0);
    throw new Error("invalid_key_length");
  }
  return bytes;
}
