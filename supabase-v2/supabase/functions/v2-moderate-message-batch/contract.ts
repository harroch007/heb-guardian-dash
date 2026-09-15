import { HttpError } from "../_shared/http.ts";

export interface BatchMessage {
  ref: string;
  text: string;
  speaker: string;
  quoted_text?: string;
}
export interface BatchRequest {
  request_id: string;
  conversation_ref: string;
  source_revision: string;
  messages: BatchMessage[];
}
export interface ModerationConfig {
  model: string;
  policyVersion: string;
  thresholds: Record<string, number>;
  maxMessages: number;
  maxTextChars: number;
  maxQuoteChars: number;
  maxBytes: number;
  timeoutMs: number;
}
// Alpha routing defaults, not calibrated probabilities or a safety guarantee.
export const ALPHA_THRESHOLDS: Record<string, number> = {
  harassment: 0.2,
  "harassment/threatening": 0.05,
  hate: 0.2,
  "hate/threatening": 0.05,
  sexual: 0.2,
  "sexual/minors": 0.05,
  "self-harm": 0.1,
  "self-harm/intent": 0.05,
  "self-harm/instructions": 0.05,
  violence: 0.2,
  "violence/graphic": 0.1,
  illicit: 0.3,
  "illicit/violent": 0.1,
};
const code = /^[a-z][a-z/-]{0,63}$/;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Prose is inspected only in memory for these fixed denial enums; never returned. */
export function providerDenial(
  status: number,
  value: unknown,
  expectedProjectId?: string,
): {
  applicationCode: string;
  code: string | null;
  type: string | null;
  classification:
    | "MODEL_ACCESS_DENIED"
    | "MISSING_SCOPE"
    | "REGION_DENIED"
    | "UNKNOWN";
  project: "PROJECT_MATCH" | "PROJECT_DIFFERENT" | "PROJECT_UNKNOWN";
  shape: {
    model: boolean;
    project: boolean;
    permission: boolean;
    region: boolean;
  };
  vocabulary: Record<string, boolean>;
} {
  const error = record(value) && record(value.error) ? value.error : {};
  const symbolic = (token: unknown): string | null =>
    typeof token === "string" && /^[a-z][a-z0-9_]{0,46}$/.test(token)
      ? token
      : null;
  const code = symbolic(error.code);
  const type = symbolic(error.type);
  const prose =
    typeof error.message === "string" && error.message.length <= 8192
      ? error.message
      : "";
  const classification =
    /does not have access to model|do not have access to (?:the )?model|not (?:allowed|permitted) to (?:use|access) (?:the )?model|model[^.\n]{0,120}(?:not enabled|not allowed)/i
        .test(prose)
      ? "MODEL_ACCESS_DENIED"
      : /unsupported (?:country|region|territory)|(?:country|region)[^.\n]{0,80}not supported|country, region, or territory/i
          .test(prose)
      ? "REGION_DENIED"
      : /missing scopes?|insufficient permissions?|insufficient scope/i.test(
          prose,
        )
      ? "MISSING_SCOPE"
      : "UNKNOWN";
  const projectIds = [
    ...new Set(prose.match(/proj_[A-Za-z0-9_-]{8,64}/g) ?? []),
  ];
  const project = !expectedProjectId || projectIds.length === 0
    ? "PROJECT_UNKNOWN"
    : projectIds.length === 1 && projectIds[0] === expectedProjectId
    ? "PROJECT_MATCH"
    : "PROJECT_DIFFERENT";
  const shape = {
    model: /model/i.test(prose),
    project: /project/i.test(prose),
    permission: /permission|scope|access|authori[sz]/i.test(prose),
    region: /region|country|territor/i.test(prose),
  };
  // Bit positions are fixed and content-free; no provider wording is retained.
  const vocabulary = Object.fromEntries([
    ["project", /project/i.test(prose)],
    ["model", /model/i.test(prose)],
    ["access", /access/i.test(prose)],
    ["permission", /permission|scope/i.test(prose)],
    ["organization", /organi[sz]ation/i.test(prose)],
    ["verified", /verif/i.test(prose)],
    ["country", /country|region|territor/i.test(prose)],
    ["policy", /polic/i.test(prose)],
    ["blocked", /block/i.test(prose)],
    ["input", /input/i.test(prose)],
    ["authorized", /authori[sz]/i.test(prose)],
    ["missing", /missing/i.test(prose)],
    ["billing", /billing/i.test(prose)],
    ["supported", /support/i.test(prose)],
  ]) as Record<string, boolean>;
  const vocabularyMask = Object.values(vocabulary).reduce(
    (mask, present, index) => mask | (present ? 1 << index : 0),
    0,
  ).toString(16).padStart(4, "0");
  const detail = classification === "UNKNOWN"
    ? code ?? type
    : classification.toLowerCase();
  const projectSuffix = project === "PROJECT_UNKNOWN"
    ? ""
    : `_${project.toLowerCase()}`;
  const diagnostic =
    classification === "UNKNOWN" && code === null && prose.length > 0
      ? `moderation_provider_http_${status}_terms_${vocabularyMask}`
      : `moderation_provider_http_${status}${
        detail ? `_${detail}` : ""
      }${projectSuffix}`;
  return {
    applicationCode: diagnostic.length <= 80
      ? diagnostic
      : `moderation_provider_http_${status}_${project.toLowerCase()}`,
    code,
    type,
    classification,
    project,
    shape,
    vocabulary,
  };
}
function integer(
  env: (key: string) => string | undefined,
  key: string,
  fallback: number,
  max: number,
): number {
  const raw = env(key);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new HttpError(503, "moderation_configuration_invalid");
  }
  return value;
}
export function readConfig(
  env: (key: string) => string | undefined,
): ModerationConfig {
  let thresholds: unknown = ALPHA_THRESHOLDS;
  try {
    if (env("KIPPY_MODERATION_THRESHOLDS_JSON")) {
      thresholds = JSON.parse(env("KIPPY_MODERATION_THRESHOLDS_JSON")!);
    }
  } catch {
    throw new HttpError(503, "moderation_configuration_invalid");
  }
  if (
    !record(thresholds) || Object.keys(thresholds).length === 0 ||
    Object.keys(thresholds).length > 32 ||
    Object.entries(thresholds).some(([key, value]) =>
      !code.test(key) || typeof value !== "number" || !Number.isFinite(value) ||
      value < 0 || value > 1
    )
  ) {
    throw new HttpError(503, "moderation_configuration_invalid");
  }
  const model = env("KIPPY_MODERATION_MODEL") ?? "omni-moderation-latest";
  const policyVersion = env("KIPPY_MODERATION_POLICY_VERSION") ??
    "moderation-alpha-v1";
  if (
    !/^[A-Za-z0-9._-]{1,100}$/.test(model) ||
    !/^[A-Za-z0-9._-]{1,80}$/.test(policyVersion)
  ) throw new HttpError(503, "moderation_configuration_invalid");
  return {
    model,
    policyVersion,
    thresholds: { ...thresholds } as Record<string, number>,
    maxMessages: integer(env, "KIPPY_MODERATION_MAX_MESSAGES", 100, 100),
    maxTextChars: integer(env, "KIPPY_MODERATION_MAX_TEXT_CHARS", 8000, 8000),
    maxQuoteChars: integer(env, "KIPPY_MODERATION_MAX_QUOTE_CHARS", 1000, 1000),
    maxBytes: integer(env, "KIPPY_MODERATION_MAX_BYTES", 1048576, 1048576),
    timeoutMs: integer(env, "KIPPY_MODERATION_TIMEOUT_MS", 15000, 30000),
  };
}
export function validateBatch(
  value: unknown,
  config: ModerationConfig,
): BatchRequest {
  if (
    !record(value) ||
    Object.keys(value).sort().join(",") !==
      "conversation_ref,messages,request_id,source_revision" ||
    typeof value.request_id !== "string" || !uuid.test(value.request_id) ||
    typeof value.conversation_ref !== "string" ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(value.conversation_ref) ||
    typeof value.source_revision !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.source_revision) ||
    !Array.isArray(value.messages) || value.messages.length < 1 ||
    value.messages.length > config.maxMessages
  ) throw new HttpError(400, "invalid_moderation_batch");
  const refs = new Set<string>();
  const messages = value.messages.map((message) => {
    if (
      !record(message) ||
      !["ref,speaker,text", "quoted_text,ref,speaker,text"].includes(
        Object.keys(message).sort().join(","),
      ) ||
      typeof message.ref !== "string" ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(message.ref) || refs.has(message.ref) ||
      typeof message.speaker !== "string" ||
      !/^(CHILD|UNKNOWN|P[0-9]{1,6})$/.test(message.speaker) ||
      typeof message.text !== "string" || message.text.trim().length === 0 ||
      message.text.length > config.maxTextChars ||
      (message.quoted_text !== undefined &&
        (typeof message.quoted_text !== "string" ||
          message.quoted_text.length > config.maxQuoteChars))
    ) throw new HttpError(400, "invalid_moderation_message");
    refs.add(message.ref);
    return {
      ref: message.ref,
      text: message.text,
      speaker: message.speaker,
      ...(message.quoted_text === undefined
        ? {}
        : { quoted_text: message.quoted_text as string }),
    };
  });
  return {
    request_id: value.request_id,
    conversation_ref: value.conversation_ref,
    source_revision: value.source_revision,
    messages,
  };
}
export function providerText(request: BatchRequest): string {
  return request.messages.map((m) =>
    `${m.speaker}: ${m.text}${
      m.quoted_text ? `\nQuoted: ${m.quoted_text}` : ""
    }`
  ).join("\n");
}
export function parseModeration(value: unknown, config: ModerationConfig) {
  if (
    !record(value) || typeof value.model !== "string" ||
    !/^[A-Za-z0-9._-]{1,100}$/.test(value.model) ||
    !Array.isArray(value.results) || value.results.length !== 1
  ) throw new HttpError(502, "invalid_moderation_response");
  const result = value.results[0];
  if (
    !record(result) || typeof result.flagged !== "boolean" ||
    !record(result.categories) || !record(result.category_scores)
  ) throw new HttpError(502, "invalid_moderation_response");
  const categories: Record<string, boolean> = {};
  const scores: Record<string, number> = {};
  const keys = Object.keys(result.category_scores);
  if (
    keys.length === 0 || keys.length > 32 ||
    Object.keys(result.categories).length !== keys.length
  ) throw new HttpError(502, "invalid_moderation_response");
  for (const key of keys) {
    const score = result.category_scores[key];
    const category = result.categories[key];
    if (
      !code.test(key) || typeof category !== "boolean" ||
      typeof score !== "number" || !Number.isFinite(score) || score < 0 ||
      score > 1
    ) throw new HttpError(502, "invalid_moderation_response");
    categories[key] = category;
    scores[key] = score;
  }
  // Missing configured categories cannot silently become a negative classification.
  if (Object.keys(config.thresholds).some((key) => !(key in scores))) {
    throw new HttpError(502, "moderation_categories_missing");
  }
  const triggers: string[] = [];
  if (result.flagged || Object.values(categories).some(Boolean)) {
    triggers.push("MODERATION_FLAGGED");
  }
  if (
    Object.entries(config.thresholds).some(([key, threshold]) =>
      scores[key] > threshold
    )
  ) triggers.push("MODERATION_CATEGORY_SCORE");
  return {
    model: value.model,
    flagged: result.flagged,
    categories,
    category_scores: scores,
    escalate: triggers.length > 0,
    trigger_codes: triggers,
  };
}
