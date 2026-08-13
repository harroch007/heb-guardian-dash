import {
  IncidentPrivateKeyConfigError,
  readIncidentPrivateKey,
} from "./incident_private_key.ts";

Deno.test("primary PKCS8 PEM secret is normalized", () => {
  const der = syntheticPkcs8Der();
  const expected = pem(der);
  const escaped = expected.replaceAll("\n", "\\n");
  const actual = readIncidentPrivateKey(
    1,
    (name) => name === "KIPPY_INCIDENT_PRIVATE_KEY_V1" ? escaped : undefined,
  );
  assertEquals(actual, expected);
  der.fill(0);
});

Deno.test("staging B64 compatibility secret accepts encoded PEM", () => {
  const der = syntheticPkcs8Der();
  const expected = pem(der);
  const encodedPem = encodeBase64(new TextEncoder().encode(expected));
  const actual = readIncidentPrivateKey(
    7,
    (name) =>
      name === "KIPPY_V2_INCIDENT_PRIVATE_KEY_V7_B64" ? encodedPem : undefined,
  );
  assertEquals(actual, expected);
  der.fill(0);
});

Deno.test("staging B64 compatibility secret accepts encoded PKCS8 DER", () => {
  const der = syntheticPkcs8Der();
  const expected = pem(der);
  const actual = readIncidentPrivateKey(
    2,
    (name) =>
      name === "KIPPY_V2_INCIDENT_PRIVATE_KEY_V2_B64"
        ? encodeBase64(der)
        : undefined,
  );
  assertEquals(actual, expected);
  der.fill(0);
});

Deno.test("invalid primary secret fails closed instead of falling back", () => {
  assertConfigError(
    () =>
      readIncidentPrivateKey(1, (name) => {
        if (name === "KIPPY_INCIDENT_PRIVATE_KEY_V1") return "not-a-key";
        if (name === "KIPPY_V2_INCIDENT_PRIVATE_KEY_V1_B64") {
          return encodeBase64(syntheticPkcs8Der());
        }
        return undefined;
      }),
    "incident_private_key_invalid",
  );
  assertConfigError(
    () =>
      readIncidentPrivateKey(1, (name) => {
        if (name === "KIPPY_INCIDENT_PRIVATE_KEY_V1") return "   ";
        if (name === "KIPPY_V2_INCIDENT_PRIVATE_KEY_V1_B64") {
          return encodeBase64(syntheticPkcs8Der());
        }
        return undefined;
      }),
    "incident_private_key_invalid",
  );
});

Deno.test("missing versioned key fails closed", () => {
  assertConfigError(
    () => readIncidentPrivateKey(1, () => undefined),
    "incident_private_key_unavailable",
  );
});

function syntheticPkcs8Der(): Uint8Array {
  const bytes = new Uint8Array(512);
  bytes[0] = 0x30;
  bytes[1] = 0x82;
  bytes[2] = 0x01;
  bytes[3] = 0xfc;
  for (let index = 4; index < bytes.length; index += 1) {
    bytes[index] = index % 251;
  }
  return bytes;
}

function pem(bytes: Uint8Array): string {
  const body = encodeBase64(bytes).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function assertConfigError(
  action: () => unknown,
  expectedCode: string,
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof IncidentPrivateKeyConfigError &&
      error.code === expectedCode
    ) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}`);
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`assertEquals failed`);
  }
}
