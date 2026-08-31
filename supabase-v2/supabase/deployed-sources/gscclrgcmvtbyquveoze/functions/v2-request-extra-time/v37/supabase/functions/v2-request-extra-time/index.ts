import { jsonResponse } from "../_shared/http.ts";

/**
 * Retained as an explicit tombstone for already-deployed staging clients.
 *
 * Kippy V2 has no child-initiated actions after setup. Additional screen time
 * can only be granted directly by a guardian from the parent PWA.
 */
Deno.serve(() =>
  jsonResponse(410, {
    error: "child_time_requests_disabled",
  })
);
