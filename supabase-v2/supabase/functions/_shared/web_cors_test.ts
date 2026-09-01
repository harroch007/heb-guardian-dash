import { resolveAllowedWebOrigin } from "./web_cors.ts";

Deno.test("treats the exact Kippy apex and www origins as one surface", () => {
  for (
    const configuredOrigin of [
      "https://kippyai.com",
      "https://www.kippyai.com",
    ]
  ) {
    assertEquals(
      resolveAllowedWebOrigin(
        "https://kippyai.com",
        configuredOrigin,
        "",
      ),
      "https://kippyai.com",
    );
    assertEquals(
      resolveAllowedWebOrigin(
        "https://www.kippyai.com",
        configuredOrigin,
        "",
      ),
      "https://www.kippyai.com",
    );
  }
});

Deno.test("rejects sibling, external, wildcard, and insecure origins", () => {
  const configuredOrigin = "https://www.kippyai.com";

  for (
    const origin of [
      "https://evil.kippyai.com",
      "https://kippyai.com.evil.example",
      "https://example.com",
      "http://www.kippyai.com",
      "*",
      null,
    ]
  ) {
    assertEquals(
      resolveAllowedWebOrigin(origin, configuredOrigin, "*"),
      null,
    );
  }
});

Deno.test("keeps explicitly configured non-Kippy origins exact", () => {
  assertEquals(
    resolveAllowedWebOrigin(
      "https://preview.example.com",
      "https://www.kippyai.com",
      "https://preview.example.com",
    ),
    "https://preview.example.com",
  );
  assertEquals(
    resolveAllowedWebOrigin(
      "https://child.preview.example.com",
      "https://www.kippyai.com",
      "https://preview.example.com",
    ),
    null,
  );
});

Deno.test("fails closed when the public origin configuration is absent", () => {
  assertEquals(
    resolveAllowedWebOrigin("https://www.kippyai.com", "", ""),
    null,
  );
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${
        JSON.stringify(expected)
      }`,
    );
  }
}
