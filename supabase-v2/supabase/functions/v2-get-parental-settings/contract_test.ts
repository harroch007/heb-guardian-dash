import { settingsRevision, withP0PrivateTextActivation } from "./contract.ts";

const NOW = 1_800_000_000_000;
const SETTINGS = {
  contract_version: 1,
  settings_revision: 7,
  daily_screen_time_limit_minutes: 120,
};

Deno.test("absent activation preserves the backward-compatible snapshot", () => {
  assertEquals(
    withP0PrivateTextActivation(SETTINGS, null, NOW),
    SETTINGS,
  );
});

Deno.test("a current revision-matched enabled contract is projected", () => {
  assertEquals(
    withP0PrivateTextActivation(SETTINGS, activation(), NOW),
    {
      ...SETTINGS,
      p0_private_text_activation: {
        contract_version: 1,
        enabled: true,
        valid_until_epoch_ms: NOW + 60_000,
      },
    },
  );
});

Deno.test("an explicit disabled contract remains OFF and revisioned", () => {
  assertEquals(
    withP0PrivateTextActivation(
      SETTINGS,
      activation({ enabled: false }),
      NOW,
    ),
    {
      ...SETTINGS,
      p0_private_text_activation: {
        contract_version: 1,
        enabled: false,
        valid_until_epoch_ms: NOW + 60_000,
      },
    },
  );
});

Deno.test("expired malformed and mixed-revision contracts remain absent", () => {
  const candidates = [
    activation({ valid_until_epoch_ms: NOW }),
    activation({ contract_version: 2 }),
    activation({ enabled: "true" }),
    activation({ settings_revision: 8 }),
    { enabled: true },
    "invalid",
  ];

  for (const candidate of candidates) {
    assertEquals(
      withP0PrivateTextActivation(SETTINGS, candidate, NOW),
      SETTINGS,
    );
  }
});

Deno.test("a database-injected field cannot bypass the canonical selector", () => {
  const injected = {
    ...SETTINGS,
    p0_private_text_activation: {
      contract_version: 1,
      enabled: true,
      valid_until_epoch_ms: NOW + 1_000_000,
    },
  };
  assertEquals(
    withP0PrivateTextActivation(injected, null, NOW),
    SETTINGS,
  );
});

Deno.test("settings revision accepts only non-negative safe integers", () => {
  assertEquals(settingsRevision(SETTINGS), 7);
  assertEquals(settingsRevision({ settings_revision: -1 }), null);
  assertEquals(settingsRevision({ settings_revision: 1.5 }), null);
  assertEquals(settingsRevision({}), null);
});

function activation(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    contract_version: 1,
    enabled: true,
    valid_until_epoch_ms: NOW + 60_000,
    settings_revision: 7,
    ...overrides,
  };
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
