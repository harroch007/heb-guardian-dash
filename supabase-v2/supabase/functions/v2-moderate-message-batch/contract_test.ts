import {
  ALPHA_THRESHOLDS,
  parseModeration,
  providerDenial,
  providerText,
  readConfig,
  validateBatch,
} from "./contract.ts";
function assert(ok: unknown) {
  if (!ok) throw new Error("assertion_failed");
}
function rejects(fn: () => unknown) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  assert(failed);
}
const config = readConfig(() => undefined);
Deno.test("denial diagnostic accepts symbolic code/type and excludes prose", () => {
  const denied = providerDenial(403, {
    error: {
      code: "unsupported_country_region_territory",
      type: "request_forbidden",
      message: "not retained",
    },
  });
  assert(
    denied.applicationCode ===
      "moderation_provider_http_403_unsupported_country_region_territory",
  );
  assert(!JSON.stringify(denied).includes("not retained"));
  const malformed = providerDenial(403, {
    error: {
      code: "an email@example.com",
      type: "invalid_request_error",
      message: "ignored",
    },
  });
  assert(
    malformed.code === null &&
      malformed.type === "invalid_request_error" &&
      malformed.applicationCode.endsWith("terms_0000"),
  );
  assert(
    providerDenial(403, { error: { code: "x".repeat(48) } }).applicationCode ===
      "moderation_provider_http_403",
  );
});
Deno.test("denial prose yields only fixed enums and project comparison", () => {
  const expected = "proj_1234567890123456";
  const actual = providerDenial(403, {
    error: {
      type: "invalid_request_error",
      message:
        `Project '${expected}' does not have access to model 'omni-moderation-latest'`,
    },
  }, expected);
  assert(
    actual.classification === "MODEL_ACCESS_DENIED" &&
      actual.project === "PROJECT_MATCH",
  );
  assert(
    !JSON.stringify(actual).includes(expected) &&
      !JSON.stringify(actual).includes("omni-moderation-latest"),
  );
  assert(
    providerDenial(403, {
      error: { message: "Missing scopes: api.moderations.write" },
    }).classification === "MISSING_SCOPE",
  );
  assert(
    providerDenial(403, {
      error: { message: "Request from unsupported country" },
    }).classification === "REGION_DENIED",
  );
  assert(
    providerDenial(403, {
      error: { message: "Project proj_abcdefghijklmnop denied" },
    }, expected).project === "PROJECT_DIFFERENT",
  );
});
const batch = () => ({
  request_id: "12345678-1234-4234-8234-123456789012",
  conversation_ref: "abcdefghijklmnopqrstuv",
  source_revision: "a".repeat(64),
  messages: [{ ref: "M0000", speaker: "CHILD", text: "x" }],
});
function result(flagged = false, score = 0) {
  return {
    model: "omni-moderation-latest",
    results: [{
      flagged,
      categories: Object.fromEntries(
        Object.keys(ALPHA_THRESHOLDS).map((k) => [k, false]),
      ),
      category_scores: Object.fromEntries(
        Object.keys(ALPHA_THRESHOLDS).map((k) => [k, score]),
      ),
    }],
  };
}
Deno.test("whole message survives maximum bound and over-limit is rejected", () => {
  const b = batch();
  b.messages[0].text = "x".repeat(8000);
  assert(validateBatch(b, config).messages[0].text.length === 8000);
  b.messages[0].text += "x";
  rejects(() => validateBatch(b, config));
});
Deno.test("batch enforces identity revision speaker and distinct evidence refs", () => {
  const b = batch();
  b.messages.push({ ...b.messages[0] });
  rejects(() => validateBatch(b, config));
  rejects(() => validateBatch({ ...batch(), source_revision: "" }, config));
  const unsafe = batch();
  unsafe.messages[0].speaker = "display name";
  rejects(() => validateBatch(unsafe, config));
});
Deno.test("chronology and quote stay intact without prefix truncation", () => {
  const b = batch();
  b.messages.push({ ref: "M0001", speaker: "P0001", text: "last" });
  const s = providerText(validateBatch(b, config));
  assert(s === "CHILD: x\nP0001: last");
});
Deno.test("unflagged score can request context; all-zero is only gate negative", () => {
  assert(parseModeration(result(false, .25), config).escalate);
  assert(!parseModeration(result(), config).escalate);
  assert(parseModeration(result(true), config).escalate);
});
Deno.test("incomplete or malformed provider response is never safe", () => {
  rejects(() => parseModeration({}, config));
  const r = result();
  delete r.results[0].category_scores.harassment;
  rejects(() => parseModeration(r, config));
  const invalid = result();
  invalid.results[0].category_scores.harassment = NaN;
  rejects(() => parseModeration(invalid, config));
});
Deno.test("threshold config is validated rather than silently falling back", () => {
  rejects(() =>
    readConfig((key) =>
      key === "KIPPY_MODERATION_THRESHOLDS_JSON" ? "{}" : undefined
    )
  );
  rejects(() =>
    readConfig((key) =>
      key === "KIPPY_MODERATION_THRESHOLDS_JSON"
        ? ' {"harassment":1.1}'
        : undefined
    )
  );
  const custom = readConfig((key) =>
    key === "KIPPY_MODERATION_THRESHOLDS_JSON"
      ? '{"harassment":0.9}'
      : undefined
  );
  assert(!parseModeration(result(false, .5), custom).escalate);
});
