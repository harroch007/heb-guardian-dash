import {
  applicationServerKeysMatch,
  decodeVapidApplicationServerKey,
  normalizeV2PushRuntimeConfig,
} from "../../../../src/lib/v2/pushConfigContract.ts";

Deno.test("Guardian push config accepts only the authoritative contract", () => {
  const publicKey = syntheticP256PublicKey();
  assertEquals(
    normalizeV2PushRuntimeConfig({
      contract_version: 1,
      application_server_key: publicKey,
      delivery_enabled: false,
      additive_future_field: "ignored",
    }),
    {
      contract_version: 1,
      application_server_key: publicKey,
      delivery_enabled: false,
    },
  );

  assertThrows(() => normalizeV2PushRuntimeConfig(null));
  assertThrows(() =>
    normalizeV2PushRuntimeConfig({
      contract_version: 2,
      application_server_key: publicKey,
      delivery_enabled: false,
    })
  );
  assertThrows(() =>
    normalizeV2PushRuntimeConfig({
      contract_version: 1,
      application_server_key: "hardcoded-fallback-is-forbidden",
      delivery_enabled: false,
    })
  );
  assertThrows(() =>
    normalizeV2PushRuntimeConfig({
      contract_version: 1,
      application_server_key: publicKey,
      delivery_enabled: "false",
    })
  );
});

Deno.test("Guardian rotates subscriptions whose VAPID key differs", () => {
  const configured = decodeVapidApplicationServerKey(syntheticP256PublicKey());
  const same = configured.slice().buffer as ArrayBuffer;
  const differentBytes = configured.slice();
  differentBytes[differentBytes.length - 1] ^= 1;

  assertTrue(applicationServerKeysMatch(same, configured));
  assertFalse(applicationServerKeysMatch(differentBytes.buffer, configured));
  assertFalse(applicationServerKeysMatch(null, configured));
  assertThrows(() => decodeVapidApplicationServerKey("invalid"));
  assertThrows(() => decodeVapidApplicationServerKey("A".repeat(88)));
});

function syntheticP256PublicKey(): string {
  const bytes = new Uint8Array(65);
  bytes[0] = 4;
  for (let index = 1; index < bytes.length; index += 1) {
    bytes[index] = index;
  }
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${
        JSON.stringify(expected)
      }`,
    );
  }
}

function assertThrows(callback: () => unknown): void {
  let threw = false;
  try {
    callback();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("assertThrows failed");
}

function assertTrue(value: boolean): void {
  if (!value) throw new Error("assertTrue failed");
}

function assertFalse(value: boolean): void {
  if (value) throw new Error("assertFalse failed");
}
