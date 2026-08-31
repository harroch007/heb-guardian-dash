export class IncidentPrivateKeyConfigError extends Error {
  readonly code:
    | "incident_private_key_unavailable"
    | "incident_private_key_invalid";

  constructor(
    code:
      | "incident_private_key_unavailable"
      | "incident_private_key_invalid",
  ) {
    super(code);
    this.name = "IncidentPrivateKeyConfigError";
    this.code = code;
  }
}

type EnvironmentReader = (name: string) => string | undefined;

/**
 * Resolves the PKCS#8 key used by a claimed incident.
 *
 * New deployments should use KIPPY_INCIDENT_PRIVATE_KEY_V<n> with a PEM
 * value. Kippy V2 staging predates that name and stores the same key under
 * KIPPY_V2_INCIDENT_PRIVATE_KEY_V<n>_B64. The compatibility path accepts
 * either a base64-encoded PEM or base64-encoded PKCS#8 DER and returns one
 * canonical PEM value. A present-but-invalid primary secret never falls back
 * to the compatibility secret.
 */
export function readIncidentPrivateKey(
  keyVersion: number,
  readEnvironment: EnvironmentReader = (name) => Deno.env.get(name),
): string {
  if (
    !Number.isSafeInteger(keyVersion) ||
    keyVersion < 1 ||
    keyVersion > 2_147_483_647
  ) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }

  const primaryName = `KIPPY_INCIDENT_PRIVATE_KEY_V${keyVersion}`;
  const primary = readEnvironment(primaryName);
  if (primary !== undefined) {
    if (primary.trim().length === 0) {
      throw new IncidentPrivateKeyConfigError(
        "incident_private_key_invalid",
      );
    }
    return normalizePkcs8Pem(primary);
  }

  const compatibilityName = `KIPPY_V2_INCIDENT_PRIVATE_KEY_V${keyVersion}_B64`;
  const compatibility = readEnvironment(compatibilityName);
  if (compatibility === undefined) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_unavailable",
    );
  }
  if (compatibility.trim().length === 0) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }

  const decoded = decodeBase64Secret(compatibility);
  try {
    let decodedText: string | undefined;
    try {
      decodedText = new TextDecoder("utf-8", { fatal: true }).decode(
        decoded,
      );
    } catch {
      decodedText = undefined;
    }

    if (decodedText?.trimStart().startsWith("-----BEGIN PRIVATE KEY-----")) {
      return normalizePkcs8Pem(decodedText);
    }
    return pkcs8DerToPem(decoded);
  } finally {
    decoded.fill(0);
  }
}

function normalizePkcs8Pem(value: string): string {
  if (value.length > 32_768) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }
  const normalizedNewlines = value.replaceAll("\\n", "\n").trim();
  const match = normalizedNewlines.match(
    /^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/_=\s-]+?)\s+-----END PRIVATE KEY-----$/,
  );
  if (match === null) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }

  const der = decodeBase64Secret(match[1]);
  try {
    return pkcs8DerToPem(der);
  } finally {
    der.fill(0);
  }
}

function pkcs8DerToPem(der: Uint8Array): string {
  if (
    der.byteLength < 256 ||
    der.byteLength > 8_192 ||
    der[0] !== 0x30
  ) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }
  const body = encodeBase64(der);
  const lines = body.match(/.{1,64}/g);
  if (lines === null) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }
  return `-----BEGIN PRIVATE KEY-----\n${
    lines.join("\n")
  }\n-----END PRIVATE KEY-----`;
}

function decodeBase64Secret(value: string): Uint8Array {
  const compact = value.replaceAll(/\s/g, "");
  if (
    compact.length === 0 ||
    compact.length > 43_692 ||
    !/^[A-Za-z0-9+/_-]*={0,2}$/.test(compact) ||
    compact.slice(0, -2).includes("=")
  ) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }

  const unpadded = compact.replaceAll("=", "");
  if (unpadded.length % 4 === 1) {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }
  const standard = unpadded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new IncidentPrivateKeyConfigError(
      "incident_private_key_invalid",
    );
  }
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}
