export type GuardianExpertOutcome = "confirmed" | "dismissed" | "inconclusive";
export interface GuardianClassification {
  category: string;
  severity: string;
  childRole: string;
  confidence: number;
}
export interface GuardianCaseProjection {
  assessment_seq: number;
  expert_outcome: string;
  expert_category: string | null;
  expert_severity: string | null;
  expert_child_role: string | null;
  expert_confidence: number | null;
}
export function projectGuardianAssessment(
  original: GuardianClassification,
  hasExpertAssessment: boolean,
  projection?: GuardianCaseProjection,
) {
  if (!projection) return {
    ...original,
    assessmentSource: hasExpertAssessment ? "expert" as const : "initial_candidate" as const,
    expertOutcome: null as GuardianExpertOutcome | null,
    assessmentSeq: null as number | null,
    historicalFirstConfirmation: null as GuardianClassification | null,
  };
  const outcome = projection.expert_outcome;
  if (!["confirmed", "dismissed", "inconclusive"].includes(outcome)) {
    throw new Error("invalid_guardian_case_outcome");
  }
  if (outcome === "confirmed" && (!projection.expert_category || !projection.expert_severity)) {
    throw new Error("missing_confirmed_case_classification");
  }
  // A non-confirmed result may include provisional expert fields; none is a
  // current confirmed classification and none falls back to historical severity.
  const confirmed = outcome === "confirmed";
  return {
    category: confirmed ? projection.expert_category : null,
    severity: confirmed ? projection.expert_severity : null,
    childRole: confirmed ? projection.expert_child_role : null,
    confidence: confirmed ? projection.expert_confidence : null,
    assessmentSource: "expert" as const,
    expertOutcome: outcome as GuardianExpertOutcome,
    assessmentSeq: projection.assessment_seq,
    historicalFirstConfirmation: hasExpertAssessment ? original : null,
  };
}
export function guardianCurrentOutcomeLabel(outcome: GuardianExpertOutcome | null): string | null {
  return outcome === "dismissed" ? "לא אושר חשש בבדיקה העדכנית"
    : outcome === "inconclusive" ? "הבדיקה העדכנית לא הכריעה" : null;
}
