/** Coded model rationale only. Never accepts prose or changes the risk decision. */
export const EXPLANATION_CODES = [
  "ORDINARY_CONVERSATION",
  "NON_LITERAL_OR_BANTER",
  "THIRD_PARTY_DISCUSSION",
  "NO_SUPPORTED_TARGETED_HARM",
  "DIRECT_TARGETED_HARM",
  "REPEATED_HARM_PATTERN",
  "COERCION_OR_EXPLOITATION",
  "SEXUAL_SAFETY_CONCERN",
  "SELF_HARM_CONCERN",
  "PERSONAL_INFORMATION_EXPOSURE",
  "SUSPICIOUS_REQUEST",
  "AMBIGUOUS_MEANING",
  "UNCERTAIN_ATTRIBUTION",
  "CONTEXT_GAP",
] as const;
export type ExplanationStatus = "AVAILABLE" | "NOT_PROVIDED" | "INVALID";
export interface ExpertExplanation {
  contract_version: "KIPPY_EXPERT_EXPLANATION_V1";
  statements: {
    code: typeof EXPLANATION_CODES[number];
    evidence_segment_refs: string[];
  }[];
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length &&
    expected.every((key) => key in value);
}
export function optionalExplanation(
  value: unknown,
  analysisRefs: readonly string[],
  snapshotRefs: readonly string[],
): {
  explanation_status: ExplanationStatus;
  explanation: ExpertExplanation | null;
} {
  if (value === undefined || value === null) {
    return { explanation_status: "NOT_PROVIDED", explanation: null };
  }
  const invalid = { explanation_status: "INVALID" as const, explanation: null };
  if (
    !record(value) || !keys(value, ["contract_version", "statements"]) ||
    value.contract_version !== "KIPPY_EXPERT_EXPLANATION_V1" ||
    !Array.isArray(value.statements) ||
    value.statements.length < 1 || value.statements.length > 3
  ) return invalid;
  const codes = new Set<string>();
  const allowed = new Set(
    analysisRefs.filter((ref) => snapshotRefs.includes(ref)),
  );
  for (const statement of value.statements) {
    if (
      !record(statement) ||
      !keys(statement, ["code", "evidence_segment_refs"]) ||
      typeof statement.code !== "string" ||
      !EXPLANATION_CODES.includes(
        statement.code as typeof EXPLANATION_CODES[number],
      ) ||
      codes.has(statement.code) ||
      !Array.isArray(statement.evidence_segment_refs) ||
      statement.evidence_segment_refs.length < 1 ||
      statement.evidence_segment_refs.length > 5 ||
      new Set(statement.evidence_segment_refs).size !==
        statement.evidence_segment_refs.length ||
      statement.evidence_segment_refs.some((ref) =>
        typeof ref !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(ref) ||
        !allowed.has(ref)
      )
    ) return invalid;
    codes.add(statement.code);
  }
  return {
    explanation_status: "AVAILABLE",
    explanation: value as unknown as ExpertExplanation,
  };
}
export const EXPLANATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["contract_version", "statements"],
  properties: {
    contract_version: { type: "string", enum: ["KIPPY_EXPERT_EXPLANATION_V1"] },
    statements: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "evidence_segment_refs"],
        properties: {
          code: { type: "string", enum: EXPLANATION_CODES },
          evidence_segment_refs: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string", pattern: "^[A-Za-z0-9_-]{22}$" },
          },
        },
      },
    },
  },
};
