import {
  isCanonicalIncidentTimestamp,
  isCanonicalIncidentUuid,
} from "./incident_submission.ts";

Deno.test("incident UUID accepts only canonical lowercase text", () => {
  assert(
    isCanonicalIncidentUuid(
      "11111111-1111-4111-8111-111111111111",
    ),
  );
  assert(
    isCanonicalIncidentUuid(
      "11111111-1111-8111-8111-111111111111",
    ),
  );
  assert(
    !isCanonicalIncidentUuid(
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    ),
  );
  assert(
    !isCanonicalIncidentUuid(
      "{11111111-1111-4111-8111-111111111111}",
    ),
  );
});

Deno.test("AAD v3 timestamp is byte-canonical before parsing", () => {
  assert(
    isCanonicalIncidentTimestamp("2026-07-29T12:34:56.789Z"),
  );
  assert(
    !isCanonicalIncidentTimestamp("2026-07-29T12:34:56Z"),
  );
  assert(
    !isCanonicalIncidentTimestamp("2026-07-29T12:34:56.789+00:00"),
  );
  assert(
    !isCanonicalIncidentTimestamp("2026-02-30T12:34:56.789Z"),
  );
});

function assert(value: boolean): void {
  if (!value) throw new Error("assertion_failed");
}
