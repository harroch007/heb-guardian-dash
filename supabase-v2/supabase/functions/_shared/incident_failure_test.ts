import { classifyOpenAIHttpStatus } from "./incident_failure.ts";

Deno.test("retryable OpenAI HTTP failures are provider transient", () => {
  for (const status of [408, 409, 429, 500, 503]) {
    assertEquals(classifyOpenAIHttpStatus(status), {
      retryable: true,
      failureClass: "provider_transient",
    });
  }
});

Deno.test("successful non-JSON responses are provider transient", () => {
  for (const status of [200, 204, 206]) {
    assertEquals(classifyOpenAIHttpStatus(status), {
      retryable: true,
      failureClass: "provider_transient",
    });
  }
});

Deno.test("configuration HTTP failures remain configuration", () => {
  for (
    const status of [307, 400, 401, 402, 403, 404, 405, 410, 413, 415, 422]
  ) {
    assertEquals(classifyOpenAIHttpStatus(status), {
      retryable: true,
      failureClass: "configuration",
    });
  }
});

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}
