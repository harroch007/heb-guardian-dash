import { supabase } from "@/integrations/supabase/client";

export const CONTROL_TOWER_LIVE_LAB_FUNCTION = "v2-control-tower-live-lab";
export const CONTROL_TOWER_LIVE_LAB_REQUEST_SCHEMA = "ct-live-lab-request-v1" as const;
export const CONTROL_TOWER_LIVE_LAB_RESPONSE_SCHEMA = "ct-live-lab-response-v1" as const;

const MAX_RESPONSE_STRING_LENGTH = 20_000;

export const CONTROL_TOWER_LIVE_LAB_SCENARIO_IDS = [
  "accessibility-permission",
  "device-offline",
  "parental-status",
  "coupon-question",
  "privacy-delete",
  "safety-escalation",
  "human-request",
  "ownership-conflict",
] as const;

export type ControlTowerLiveLabScenarioId =
  (typeof CONTROL_TOWER_LIVE_LAB_SCENARIO_IDS)[number];

export interface ControlTowerLiveLabRequest {
  schema_version: typeof CONTROL_TOWER_LIVE_LAB_REQUEST_SCHEMA;
  scenario_id: ControlTowerLiveLabScenarioId;
  synthetic_test_only: true;
  locale: "he-IL";
  session_id: string;
}

export type LiveLabRiskLevel = "low" | "medium" | "high" | "critical";

export interface ControlTowerLiveLabResponse {
  schema_version: typeof CONTROL_TOWER_LIVE_LAB_RESPONSE_SCHEMA;
  run_id: string;
  session_id: string | null;
  execution_mode: "internal_live_lab";
  selected_agent: {
    agent_id: string;
    display_name: string;
    confidence: number;
  };
  routing: {
    intent_key: string;
    reason_summary: string;
    human_required: boolean;
    risk_level: LiveLabRiskLevel;
    evidence_codes: string[];
  };
  draft_response: {
    text: string;
    internal_summary: string;
    next_question: string | null;
    status: "draft_only";
  };
  safety: {
    tools_executed: 0;
    mutations_applied: 0;
    outbound_messages_sent: 0;
    customer_data_persisted: false;
  };
  model: {
    provider: "openai";
    classifier_model: string;
    responder_model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  };
  timing: {
    total_ms: number;
  };
}

export type ControlTowerLiveLabErrorCode =
  | "invalid_request"
  | "invoke_failed"
  | "invalid_response";

export class ControlTowerLiveLabError extends Error {
  readonly code: ControlTowerLiveLabErrorCode;

  constructor(code: ControlTowerLiveLabErrorCode) {
    super(code);
    this.name = "ControlTowerLiveLabError";
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactObject(value: unknown, keys: readonly string[]): JsonRecord {
  if (!isRecord(value)) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return value;
}

function requireString(value: unknown, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && value.trim().length === 0) ||
    value.length > MAX_RESPONSE_STRING_LENGTH
  ) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return value;
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return value;
}

function requireNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return value;
}

function requireLiteral<T extends string | number | boolean>(value: unknown, expected: T): T {
  if (value !== expected) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return expected;
}

function requireNullableString(value: unknown): string | null {
  return value === null ? null : requireString(value);
}

function requireRiskLevel(value: unknown): LiveLabRiskLevel {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  throw new ControlTowerLiveLabError("invalid_response");
}

function requireStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return value.map((item) => requireString(item));
}

export function decodeControlTowerLiveLabResponse(value: unknown): ControlTowerLiveLabResponse {
  const response = requireExactObject(value, [
    "schema_version",
    "run_id",
    "session_id",
    "execution_mode",
    "selected_agent",
    "routing",
    "draft_response",
    "safety",
    "model",
    "timing",
  ]);

  const selectedAgent = requireExactObject(response.selected_agent, [
    "agent_id",
    "display_name",
    "confidence",
  ]);
  if (
    typeof selectedAgent.confidence !== "number" ||
    !Number.isFinite(selectedAgent.confidence) ||
    selectedAgent.confidence < 0 ||
    selectedAgent.confidence > 1
  ) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  const routing = requireExactObject(response.routing, [
    "intent_key",
    "reason_summary",
    "human_required",
    "risk_level",
    "evidence_codes",
  ]);
  const draftResponse = requireExactObject(response.draft_response, [
    "text",
    "internal_summary",
    "next_question",
    "status",
  ]);
  const safety = requireExactObject(response.safety, [
    "tools_executed",
    "mutations_applied",
    "outbound_messages_sent",
    "customer_data_persisted",
  ]);
  const model = requireExactObject(response.model, [
    "provider",
    "classifier_model",
    "responder_model",
    "usage",
  ]);
  const usage = requireExactObject(model.usage, [
    "input_tokens",
    "output_tokens",
    "total_tokens",
  ]);
  const timing = requireExactObject(response.timing, ["total_ms"]);

  const inputTokens = requireNonNegativeInteger(usage.input_tokens);
  const outputTokens = requireNonNegativeInteger(usage.output_tokens);
  const totalTokens = requireNonNegativeInteger(usage.total_tokens);
  if (totalTokens !== inputTokens + outputTokens) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return {
    schema_version: requireLiteral(
      response.schema_version,
      CONTROL_TOWER_LIVE_LAB_RESPONSE_SCHEMA,
    ),
    run_id: requireString(response.run_id),
    session_id: requireNullableString(response.session_id),
    execution_mode: requireLiteral(response.execution_mode, "internal_live_lab"),
    selected_agent: {
      agent_id: requireString(selectedAgent.agent_id),
      display_name: requireString(selectedAgent.display_name),
      confidence: selectedAgent.confidence,
    },
    routing: {
      intent_key: requireString(routing.intent_key),
      reason_summary: requireString(routing.reason_summary),
      human_required: requireBoolean(routing.human_required),
      risk_level: requireRiskLevel(routing.risk_level),
      evidence_codes: requireStringArray(routing.evidence_codes),
    },
    draft_response: {
      text: requireString(draftResponse.text),
      internal_summary: requireString(draftResponse.internal_summary),
      next_question: requireNullableString(draftResponse.next_question),
      status: requireLiteral(draftResponse.status, "draft_only"),
    },
    safety: {
      tools_executed: requireLiteral(safety.tools_executed, 0),
      mutations_applied: requireLiteral(safety.mutations_applied, 0),
      outbound_messages_sent: requireLiteral(safety.outbound_messages_sent, 0),
      customer_data_persisted: requireLiteral(safety.customer_data_persisted, false),
    },
    model: {
      provider: requireLiteral(model.provider, "openai"),
      classifier_model: requireString(model.classifier_model),
      responder_model: requireString(model.responder_model),
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
      },
    },
    timing: {
      total_ms: requireNonNegativeInteger(timing.total_ms),
    },
  };
}

export function createControlTowerLiveLabSessionId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new ControlTowerLiveLabError("invalid_request");
  }

  return globalThis.crypto.randomUUID();
}

export function createControlTowerLiveLabRequest(
  scenarioId: ControlTowerLiveLabScenarioId,
  sessionId: string,
): ControlTowerLiveLabRequest {
  if (
    !CONTROL_TOWER_LIVE_LAB_SCENARIO_IDS.includes(scenarioId) ||
    sessionId.trim().length === 0 ||
    sessionId.length > 200
  ) {
    throw new ControlTowerLiveLabError("invalid_request");
  }

  return {
    schema_version: CONTROL_TOWER_LIVE_LAB_REQUEST_SCHEMA,
    scenario_id: scenarioId,
    synthetic_test_only: true,
    locale: "he-IL",
    session_id: sessionId,
  };
}

export async function runControlTowerLiveLab(
  scenarioId: ControlTowerLiveLabScenarioId,
  sessionId: string,
): Promise<ControlTowerLiveLabResponse> {
  const request = createControlTowerLiveLabRequest(scenarioId, sessionId);
  const { data, error } = await supabase.functions.invoke<unknown>(
    CONTROL_TOWER_LIVE_LAB_FUNCTION,
    { body: request },
  );

  if (error) {
    throw new ControlTowerLiveLabError("invoke_failed");
  }

  const response = decodeControlTowerLiveLabResponse(data);
  if (response.session_id !== request.session_id) {
    throw new ControlTowerLiveLabError("invalid_response");
  }

  return response;
}
