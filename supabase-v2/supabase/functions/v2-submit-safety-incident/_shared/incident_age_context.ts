import type { DeviceIdentity } from "./auth.ts";
import type {
  SanitizedIncidentContext,
  SanitizedSafetyDecisionContext,
} from "./incident_expert.ts";

type AgeFields = Pick<
  SanitizedSafetyDecisionContext,
  "child_age_band" | "child_age_confidence" | "child_age_evidence"
>;
const UNKNOWN_AGE: AgeFields = {
  child_age_band: "unknown",
  child_age_confidence: 0,
  child_age_evidence: "child_age_unavailable",
};
const UNKNOWN_SAFETY: SanitizedSafetyDecisionContext = {
  ...UNKNOWN_AGE,
  relationship_type: "unknown",
  relationship_confidence: 0,
  relationship_evidence: "relationship_unavailable",
  conversation_setting: "unknown",
  conversation_setting_confidence: 0,
  conversation_setting_evidence: "capture_conversation_unknown",
  active_trend_counts: {},
};

/** Optional age lookup gets at most 5% of remaining context time and 500ms.
 * Near expiry it is skipped; this never imposes a minimum budget on inference. */
export function ageLookupTimeoutMs(
  deadlineMs: number,
  nowMs = Date.now(),
): number {
  const remaining = deadlineMs - nowMs;
  return !Number.isFinite(remaining) || remaining < 2_000
    ? 0
    : Math.min(500, Math.floor(remaining / 20));
}

/**
 * Called only after envelope/context/FIFO validation and only for new inference.
 * Identity comes from requireDevice, never from request body or conversation text.
 * Reuses v2_child_age_band: calendar year is approximate (estimated 9 may still be 8).
 * 0.6 denotes this source's uncertainty convention, not measured accuracy.
 */
export async function enrichExpertContextWithAge(
  original: SanitizedIncidentContext,
  identity: DeviceIdentity,
  lookupBand: (birthYear: number, calendarYear: number) => Promise<unknown>,
  calendarYear: number = new Date().getUTCFullYear(),
): Promise<SanitizedIncidentContext> {
  let age = UNKNOWN_AGE;
  const birthYear = identity.trustedBirthYear;
  if (
    typeof birthYear === "number" && Number.isInteger(birthYear) &&
    birthYear >= 2000 && birthYear <= 2100 && Number.isInteger(calendarYear) &&
    calendarYear - birthYear >= 6 && calendarYear - birthYear <= 14
  ) {
    const calendarAge = calendarYear - birthYear;
    const expectedBand = calendarAge <= 8
      ? "age_6_8"
      : calendarAge <= 11
      ? "age_9_11"
      : "age_12_14";
    try {
      const band = await lookupBand(birthYear, calendarYear);
      if (band === expectedBand) {
        age = {
          child_age_band: expectedBand,
          child_age_confidence: 0.6,
          child_age_evidence: "birth_year_calendar_estimate",
        };
      }
    } catch {
      // Missing registration metadata/RPC availability cannot block safety analysis.
    }
  }
  // Shallow copy only the model's safety metadata. Original message objects,
  // message order, frozen full_fifo metadata and its digest are untouched.
  return {
    ...original,
    safety_context: {
      ...(original.safety_context ??
        { ...UNKNOWN_SAFETY, active_trend_counts: {} }),
      ...age,
    },
  };
}
