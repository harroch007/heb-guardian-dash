import { AnalysisDeadlineError } from "./incident_deadline.ts";

/** Do not impose a minimum remaining budget that could discard acute risk. */
export function assertEphemeralContextFresh(
  expiresAt: string,
  nowMs = Date.now(),
): number {
  const deadlineMs = Date.parse(expiresAt);
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) {
    throw new AnalysisDeadlineError(
      "invalid_analysis_deadline",
      false,
      "analysis",
    );
  }
  if (deadlineMs <= nowMs) {
    throw new AnalysisDeadlineError(
      "incident_context_expired",
      false,
      "analysis",
    );
  }
  return deadlineMs;
}

export function providerTimeoutMs(
  deadlineMs?: number,
  nowMs = Date.now(),
): number {
  if (deadlineMs === undefined) return 45_000;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= nowMs) {
    throw new AnalysisDeadlineError(
      "incident_context_expired",
      false,
      "analysis",
    );
  }
  return Math.max(1, Math.min(45_000, Math.floor(deadlineMs - nowMs)));
}
