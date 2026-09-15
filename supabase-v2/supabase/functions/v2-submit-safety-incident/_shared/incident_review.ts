import { EXPLANATION_CODES } from "./incident_explanation.ts";
function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function keys(v: Record<string, unknown>, k: string[]): boolean {
  return Object.keys(v).length === k.length &&
    k.every((x) => Object.hasOwn(v, x));
}
function indexes(v: unknown, count: number, max: number): v is number[] {
  return Array.isArray(v) && v.length >= 1 && v.length <= max &&
    new Set(v).size === v.length &&
    v.every((n) => Number.isInteger(n) && n >= 0 && n < count);
}
/** An optional display extension is never allowed to fail a valid policy receipt. */
export async function optionalExpertReview(
  lookup: () => Promise<unknown>,
  count: number,
): Promise<Record<string, unknown> | null> {
  try {
    return validateExpertReview(await lookup(), count);
  } catch {
    return null;
  }
}
export function validateExpertReview(
  value: unknown,
  count: number,
): Record<string, unknown> | null {
  if (
    !Number.isInteger(count) || count < 1 || count > 60 || !record(value) ||
    !keys(value, [
      "contract_version",
      "model_version",
      "prompt_version",
      "analysis",
      "explanation_status",
      "explanation",
    ]) ||
    value.contract_version !== "KIPPY_EXPERT_REVIEW_V1" ||
    typeof value.model_version !== "string" ||
    typeof value.prompt_version !== "string" ||
    !/^[a-zA-Z0-9._-]{1,80}$/.test(value.model_version) ||
    !["kippy-expert-v4", "kippy-expert-v5", "kippy-expert-v6"].includes(
      String(value.prompt_version),
    )
  ) return null;
  const a = value.analysis;
  const categories = [
    "bullying",
    "exclusion",
    "sexual_content",
    "violence",
    "grooming",
    "manipulation",
    "stranger_contact",
    "self_harm",
    "other",
  ];
  if (
    !record(a) ||
    !keys(a, [
      "outcome",
      "primary_category",
      "secondary_categories",
      "severity",
      "urgency",
      "child_role",
      "pattern",
      "confidence",
      "evidence_indexes",
    ]) ||
    typeof a.outcome !== "string" || typeof a.urgency !== "string" ||
    typeof a.child_role !== "string" || typeof a.pattern !== "string" ||
    (a.primary_category !== null && typeof a.primary_category !== "string") ||
    (a.severity !== null && typeof a.severity !== "string") ||
    !["confirmed", "dismissed", "inconclusive"].includes(String(a.outcome)) ||
    !(a.primary_category === null ||
      categories.includes(String(a.primary_category))) ||
    !Array.isArray(a.secondary_categories) ||
    a.secondary_categories.length > 8 ||
    new Set(a.secondary_categories).size !== a.secondary_categories.length ||
    a.secondary_categories.some((c) =>
      !categories.includes(c) || c === a.primary_category
    ) ||
    !(a.severity === null ||
      ["low", "medium", "high", "critical"].includes(String(a.severity))) ||
    !["routine", "elevated", "immediate"].includes(String(a.urgency)) ||
    !["target", "participant", "initiator", "unknown"].includes(
      String(a.child_role),
    ) ||
    !["isolated", "repeated", "escalating", "unknown"].includes(
      String(a.pattern),
    ) ||
    typeof a.confidence !== "number" || !Number.isFinite(a.confidence) ||
    a.confidence < 0 || a.confidence > 1 ||
    !indexes(a.evidence_indexes, count, 60)
  ) return null;
  if (
    a.outcome === "dismissed" &&
    (a.primary_category !== null || a.severity !== null ||
      a.secondary_categories.length !== 0 || a.urgency !== "routine" ||
      a.child_role !== "unknown" || a.confidence < 0.8)
  ) return null;
  if (
    a.outcome === "confirmed" &&
    (a.primary_category === null || a.severity === null || a.confidence < 0.6)
  ) return null;
  if (
    value.explanation_status === "NOT_PROVIDED" ||
    value.explanation_status === "INVALID"
  ) return value.explanation === null ? value : null;
  const e = value.explanation;
  if (
    value.explanation_status !== "AVAILABLE" || !record(e) ||
    !keys(e, ["contract_version", "statements"]) ||
    e.contract_version !== "KIPPY_EXPERT_EXPLANATION_V1" ||
    !Array.isArray(e.statements) || e.statements.length < 1 ||
    e.statements.length > 3
  ) return null;
  const codes = new Set<string>();
  for (const s of e.statements) {
    if (
      !record(s) || !keys(s, ["code", "evidence_indexes"]) ||
      typeof s.code !== "string" ||
      !EXPLANATION_CODES.includes(s.code as typeof EXPLANATION_CODES[number]) ||
      codes.has(s.code) ||
      !indexes(s.evidence_indexes, count, 5) || s.evidence_indexes.some((n) =>
        !(a.evidence_indexes as number[]).includes(n)
      )
    ) {
      return null;
    }
    codes.add(s.code);
  }
  return value;
}
