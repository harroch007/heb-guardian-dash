import {
  deriveOpenAISafetyIdentifier,
  isValidOpenAISafetyIdentifier,
  readOpenAISafetyIdentifierConfig,
  SafetyIdentifierError,
} from "./incident_safety_identifier.ts";

const CHILD_ID = "33000000-0000-4000-8000-000000000001";
const OTHER_CHILD_ID = "33000000-0000-4000-8000-000000000002";
const KEY_MATERIAL = "gw26aA3j1UeHfrJeDvNHVdRHPVow6CWW4A2tq-q7vfA";

Deno.test("safety identifier is stable, bounded and pseudonymous", async () => {
  const config = {
    keyVersion: 7,
    keyMaterial: KEY_MATERIAL,
  };
  const first = await deriveOpenAISafetyIdentifier(CHILD_ID, config);
  const second = await deriveOpenAISafetyIdentifier(CHILD_ID, config);

  assertEquals(first, second);
  assertEquals(first.length <= 64, true);
  assertEquals(isValidOpenAISafetyIdentifier(first), true);
  assertEquals(first.includes(CHILD_ID), false);
  assertEquals(first.includes(KEY_MATERIAL), false);
});

Deno.test("safety identifier changes across child and key scope", async () => {
  const first = await deriveOpenAISafetyIdentifier(CHILD_ID, {
    keyVersion: 7,
    keyMaterial: KEY_MATERIAL,
  });
  const otherChild = await deriveOpenAISafetyIdentifier(OTHER_CHILD_ID, {
    keyVersion: 7,
    keyMaterial: KEY_MATERIAL,
  });
  const otherVersion = await deriveOpenAISafetyIdentifier(CHILD_ID, {
    keyVersion: 8,
    keyMaterial: KEY_MATERIAL,
  });

  assertEquals(first === otherChild, false);
  assertEquals(first === otherVersion, false);
});

Deno.test("safety identifier configuration is version-addressed", () => {
  const values = new Map<string, string>([
    ["KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_VERSION", "7"],
    ["KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_V7", KEY_MATERIAL],
  ]);
  const config = readOpenAISafetyIdentifierConfig(
    (name) => values.get(name),
  );
  assertEquals(config.keyVersion, 7);
  assertEquals(config.keyMaterial, KEY_MATERIAL);
});

Deno.test("safety identifier configuration fails closed", () => {
  assertThrowsCode(
    () => readOpenAISafetyIdentifierConfig(() => undefined),
    "invalid_safety_identifier_key_version",
  );
  assertThrowsCode(
    () =>
      readOpenAISafetyIdentifierConfig((name) =>
        name === "KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_VERSION"
          ? "01"
          : KEY_MATERIAL
      ),
    "invalid_safety_identifier_key_version",
  );
  assertThrowsCode(
    () =>
      readOpenAISafetyIdentifierConfig((name) =>
        name === "KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_VERSION" ? "7" : "c2hvcnQ="
      ),
    "invalid_safety_identifier_key_material",
  );
  assertThrowsCode(
    () =>
      readOpenAISafetyIdentifierConfig((name) =>
        name === "KIPPY_OPENAI_SAFETY_IDENTIFIER_KEY_VERSION"
          ? "7"
          : "!".repeat(43)
      ),
    "invalid_safety_identifier_key_material",
  );
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${
        JSON.stringify(expected)
      }`,
    );
  }
}

function assertThrowsCode(
  action: () => unknown,
  expectedCode: string,
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof SafetyIdentifierError &&
      error.code === expectedCode
    ) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}`);
}
