import type { AnalysisFailureClass } from "./incident_failure.ts";

export type AnalysisDeadlineStage =
  | "before_decrypt"
  | "before_openai"
  | "before_finalize";

interface AnalysisDeadlines {
  lease_expires_at_canonical: string;
  context_expires_at_canonical: string;
}

const STAGE_BUDGETS: Record<
  AnalysisDeadlineStage,
  { leaseMs: number; contextMs: number }
> = {
  before_decrypt: { leaseMs: 70_000, contextMs: 100_000 },
  before_openai: { leaseMs: 60_000, contextMs: 90_000 },
  before_finalize: { leaseMs: 8_000, contextMs: 38_000 },
};

export class AnalysisDeadlineError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly failureClass: AnalysisFailureClass,
  ) {
    super(code);
  }
}

export function assertAnalysisDeadline(
  deadlines: AnalysisDeadlines,
  stage: AnalysisDeadlineStage,
  nowMs: number = Date.now(),
): void {
  const leaseExpiresAt = Date.parse(
    deadlines.lease_expires_at_canonical,
  );
  const contextExpiresAt = Date.parse(
    deadlines.context_expires_at_canonical,
  );
  if (
    !Number.isFinite(nowMs) ||
    !Number.isFinite(leaseExpiresAt) ||
    !Number.isFinite(contextExpiresAt)
  ) {
    throw new AnalysisDeadlineError(
      "invalid_analysis_deadline",
      false,
      "analysis",
    );
  }

  const leaseRemainingMs = leaseExpiresAt - nowMs;
  const contextRemainingMs = contextExpiresAt - nowMs;
  if (contextRemainingMs <= 0) {
    throw new AnalysisDeadlineError(
      "incident_context_expired",
      false,
      "analysis",
    );
  }
  if (leaseRemainingMs <= 0) {
    throw new AnalysisDeadlineError(
      "analysis_lease_expired",
      true,
      "worker_transient",
    );
  }

  const budget = STAGE_BUDGETS[stage];
  if (leaseRemainingMs < budget.leaseMs) {
    throw new AnalysisDeadlineError(
      "analysis_lease_budget_insufficient",
      true,
      "worker_transient",
    );
  }
  if (contextRemainingMs < budget.contextMs) {
    throw new AnalysisDeadlineError(
      "incident_context_budget_insufficient",
      false,
      "analysis",
    );
  }
}
