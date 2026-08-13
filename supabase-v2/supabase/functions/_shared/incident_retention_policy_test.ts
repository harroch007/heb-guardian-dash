import { isOpenAIDataRetentionPolicyAcknowledged } from "./incident_retention_policy.ts";

Deno.test("retention gate accepts either exact acknowledgement", () => {
  assertEquals(
    isOpenAIDataRetentionPolicyAcknowledged("true", undefined),
    true,
  );
  assertEquals(
    isOpenAIDataRetentionPolicyAcknowledged(undefined, "true"),
    true,
  );
});

Deno.test("retention gate fails closed without exact acknowledgement", () => {
  const rejected: Array<string | undefined> = [
    undefined,
    "",
    "false",
    "TRUE",
    " true ",
    "1",
  ];
  for (const zdr of rejected) {
    for (const standard of rejected) {
      assertEquals(
        isOpenAIDataRetentionPolicyAcknowledged(zdr, standard),
        false,
      );
    }
  }
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `assertEquals failed: expected ${String(expected)}, received ${
        String(actual)
      }`,
    );
  }
}
