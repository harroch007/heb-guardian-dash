import { v2Supabase } from "@/integrations/supabase/v2-client";
import type { Database as V2Database } from "@/integrations/supabase/v2-types";

type Tables = V2Database["public"]["Tables"];
export type V2GuardianFeedback = Tables["v2_guardian_incident_feedback"]["Row"];
export type V2GuardianMissedConcern = Tables["v2_guardian_missed_concerns"]["Row"];
export type V2FeedbackUsefulness = "helpful" | "not_helpful" | "unsure";
export type V2FeedbackReason = "incorrect_interpretation" | "duplicate" | "already_handled" | "other";

export const V2_CONCERN_CATEGORIES = [
  { value: "bullying", label: "בריונות" },
  { value: "exclusion", label: "חרם והדרה" },
  { value: "sexual_content", label: "תוכן מיני" },
  { value: "violence", label: "אלימות ואיומים" },
  { value: "grooming", label: "יצירת קשר לצורך ניצול" },
  { value: "manipulation", label: "מניפולציה" },
  { value: "stranger_contact", label: "פנייה מזר" },
  { value: "self_harm", label: "פגיעה עצמית" },
  { value: "other", label: "חשש אחר לבטיחות" },
] as const;
export type V2ConcernCategory = typeof V2_CONCERN_CATEGORIES[number]["value"];

export function createV2FeedbackRequestKey(): string {
  return `guardian-feedback:${crypto.randomUUID()}`;
}

/** Never expose server error text, identifiers or payloads in parent-facing errors. */
export function v2FeedbackErrorMessage(error: unknown, operation: "load" | "save" = "save"): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? error.code
    : null;
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(String(code))) {
    return "אפשרות המשוב עדיין לא זמינה בחשבון הזה. אפשר לנסות שוב מאוחר יותר.";
  }
  if (["42501", "PGRST301", "PGRST303"].includes(String(code))) {
    return "לא ניתן לגשת למשוב כרגע. יש לרענן את הדף ולבדוק שהחשבון מחובר.";
  }
  return operation === "load"
    ? "לא ניתן לטעון את המשוב השמור כרגע. אפשר לנסות שוב."
    : "לא ניתן להשלים את הפעולה כרגע. הבחירה שלך נשמרה כאן ואפשר לנסות שוב.";
}

export async function getV2GuardianFeedback(
  incidentIds: string[],
  guardianUserId: string,
): Promise<V2GuardianFeedback[]> {
  if (incidentIds.length === 0) return [];
  const { data, error } = await v2Supabase
    .from("v2_guardian_incident_feedback")
    .select("incident_id, guardian_user_id, usefulness, reason, created_at, updated_at")
    .in("incident_id", incidentIds)
    .eq("guardian_user_id", guardianUserId);
  if (error) throw error;
  return data ?? [];
}

export async function submitV2GuardianFeedback(input: {
  incidentId: string;
  usefulness: V2FeedbackUsefulness;
  reason: V2FeedbackReason | null;
  requestKey: string;
}): Promise<V2GuardianFeedback> {
  if (input.usefulness === "not_helpful" && !input.reason) {
    throw new Error("Feedback reason is required");
  }
  const { data, error } = await v2Supabase.rpc("v2_submit_guardian_incident_feedback", {
    target_incident_id: input.incidentId,
    target_usefulness: input.usefulness,
    target_reason: input.usefulness === "not_helpful" ? input.reason : null,
    target_request_key: input.requestKey,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Feedback response was empty");
  return row;
}

export async function reportV2MissedConcern(input: {
  childId: string;
  category: V2ConcernCategory;
  occurredOn: string;
  requestKey: string;
}): Promise<V2GuardianMissedConcern> {
  const { data, error } = await v2Supabase.rpc("v2_report_missed_safety_concern", {
    target_child_id: input.childId,
    target_category: input.category,
    target_occurred_on: input.occurredOn,
    target_request_key: input.requestKey,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("Missed concern response was empty");
  return row;
}
