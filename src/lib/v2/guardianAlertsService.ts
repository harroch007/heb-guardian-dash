import { v2Supabase } from "@/integrations/supabase/v2-client";
import type { Database as V2Database } from "@/integrations/supabase/v2-types";
import { projectGuardianAssessment, type GuardianClassification, type GuardianExpertOutcome } from "./guardianAlertProjection";

type Tables = V2Database["public"]["Tables"];
type Incident = Tables["v2_safety_incidents"]["Row"];
type Analysis = Tables["v2_incident_analysis"]["Row"];
type AnalysisDetails = Tables["v2_incident_analysis_details"]["Row"];
type GuardianState = Tables["v2_guardian_incident_states"]["Row"];
type CaseSummary = V2Database["public"]["Functions"]["v2_get_guardian_case_summaries"]["Returns"][number];
type LegacyCaseProjection = V2Database["public"]["Functions"]["v2_get_guardian_three_gate_projections"]["Returns"][number];

export type V2GuardianIncidentState = "new" | "saved" | "acknowledged";

export interface V2GuardianAlert {
  id: string;
  childId: string;
  childName: string;
  category: string | null;
  severity: string | null;
  childRole: string | null;
  confidence: number | null;
  expertOutcome: GuardianExpertOutcome | null;
  assessmentSeq: number | null;
  historicalFirstConfirmation: GuardianClassification | null;
  assessmentSource: "expert" | "initial_candidate";
  sourcePlatform: string;
  occurredAt: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  state: V2GuardianIncidentState;
  latestAssessmentAt: string | null;
  attentionAssessmentSeq: number | null;
  acknowledgedAssessmentSeq: number | null;
  acknowledgedAt: string | null;
  guardianStateVersion: number | null;
  caseDetailsAvailable: boolean;
  conversationLabel: string | null;
  conversationType: "private" | "group" | null;
  historyAssessmentCount: number | null;
}

export interface V2GuardianAssessment {
  assessmentSeq: number;
  completedAt: string;
  outcome: GuardianExpertOutcome;
  category: string | null;
  severity: string | null;
  childRole: string | null;
  summary: string;
  reason: string;
  recommendedAction: string;
  recommendationIsHistorical: boolean;
  isAttentionUpdate: boolean;
}

const requestKey = () => `guardian-incident:${crypto.randomUUID()}`;
const isMissingRpc = (error: { code?: string } | null) =>
  error && ["PGRST202", "42883"].includes(error.code ?? "");
const validIncidentId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function isGuardianAssessmentConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === "23505" &&
    /guardian_(assessment_version|state_version)_conflict/.test(candidate.message ?? "");
}

async function getCaseProjections(incidentIds: string[]): Promise<{ summaries: CaseSummary[]; legacy: LegacyCaseProjection[] }> {
  const current = await v2Supabase.rpc("v2_get_guardian_case_summaries", { target_incident_ids: incidentIds });
  if (!current.error) return { summaries: current.data ?? [], legacy: [] };
  if (!isMissingRpc(current.error)) throw current.error;
  const legacy = await v2Supabase.rpc("v2_get_guardian_three_gate_projections", { target_incident_ids: incidentIds });
  if (legacy.error && !isMissingRpc(legacy.error)) throw legacy.error;
  return { summaries: [], legacy: legacy.data ?? [] };
}

export async function getV2GuardianAlerts(input: {
  familyId: string;
  childId?: string | null;
}): Promise<{
  children: Array<{ id: string; displayName: string }>;
  alerts: V2GuardianAlert[];
}> {
  return loadGuardianAlerts(input);
}

async function loadGuardianAlerts(input: { familyId: string; childId?: string | null; incidentId?: string }) {
  const { data: childrenData, error: childrenError } = await v2Supabase
    .from("v2_children")
    .select("id, display_name")
    .eq("family_id", input.familyId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (childrenError) throw childrenError;

  const children = (childrenData ?? []).map((child) => ({
    id: child.id,
    displayName: child.display_name,
  }));
  const allowedChildIds = children.map((child) => child.id);
  const scopedChildIds = input.childId
    ? allowedChildIds.filter((id) => id === input.childId)
    : allowedChildIds;

  if (scopedChildIds.length === 0) return { children, alerts: [] };

  const incidentQuery = () => v2Supabase
    .from("v2_safety_incidents")
    .select("*")
    .in("child_id", scopedChildIds)
    .in("status", ["confirmed", "alerted"]);
  // A notification can refer to a handled or older case outside the bounded list.
  // Keep the family/active-child scope on the independent exact-ID query too.
  let incidentResult = await (input.incidentId
    ? incidentQuery().eq("id", input.incidentId)
    : incidentQuery().order("updated_at", { ascending: false }).order("occurred_at", { ascending: false }).limit(250));
  // Before the additive migration, the original list remains readable. Case
  // mutation is still disabled when its versioned capability is unavailable.
  if (!input.incidentId && incidentResult.error?.code === "42703" && incidentResult.error.message.includes("updated_at")) {
    incidentResult = await incidentQuery().order("occurred_at", { ascending: false }).limit(250);
  }
  const { data: incidentData, error: incidentError } = incidentResult;
  if (incidentError) throw incidentError;

  const incidents = (incidentData ?? []) as Incident[];
  if (incidents.length === 0) return { children, alerts: [] };

  const incidentIds = incidents.map((incident) => incident.id);
  const [analysesResult, statesResult, detailsResult, caseProjectionsResult] = await Promise.all([
    v2Supabase
      .from("v2_incident_analysis")
      .select("*")
      .in("incident_id", incidentIds)
      .eq("outcome", "confirmed"),
    v2Supabase
      .from("v2_guardian_incident_states")
      .select("*")
      .in("incident_id", incidentIds),
    v2Supabase
      .from("v2_incident_analysis_details")
      .select("incident_id, expert_category, expert_severity, expert_child_role, expert_confidence")
      .in("incident_id", incidentIds),
    getCaseProjections(incidentIds),
  ]);
  if (analysesResult.error) throw analysesResult.error;
  if (statesResult.error) throw statesResult.error;
  const caseSummaries = new Map(caseProjectionsResult.summaries.map((row) => [row.incident_id, row]));
  const legacyProjections = new Map(caseProjectionsResult.legacy.map((row) => [row.incident_id, row]));
  // Optional metadata may be unavailable during rollout. The safe summary and
  // recommended action remain readable; the UI explicitly labels the fallback.
  const detailsByIncident = new Map(
    (detailsResult.error ? [] : detailsResult.data ?? []).map((details) => [details.incident_id, details]),
  );

  const analysisByIncident = new Map(
    ((analysesResult.data ?? []) as Analysis[]).map((analysis) => [
      analysis.incident_id,
      analysis,
    ]),
  );
  const stateByIncident = new Map(
    ((statesResult.data ?? []) as GuardianState[]).map((state) => [
      state.incident_id,
      state,
    ]),
  );
  const childNameById = new Map(
    children.map((child) => [child.id, child.displayName]),
  );

  const alerts: V2GuardianAlert[] = [];
  for (const incident of incidents) {
    const analysis = analysisByIncident.get(incident.id);
    if (
      !analysis?.safe_summary ||
      !analysis.safe_reason ||
      !analysis.recommended_action
    ) {
      continue;
    }
    const storedState = stateByIncident.get(incident.id);
    const caseSummary = caseSummaries.get(incident.id);
    const state = caseSummary?.guardian_state ?? storedState?.state;
    const caseProjection = caseSummary ?? legacyProjections.get(incident.id);
    const details: Pick<AnalysisDetails, "incident_id" | "expert_category" | "expert_severity" | "expert_child_role" | "expert_confidence"> | undefined = detailsByIncident.get(incident.id);
    // Candidate metadata is only a referral proposal. Prefer the server analysis,
    // and identify legacy rows without usable expert details instead of implying certainty.
    const hasExpertAssessment = Boolean(details?.expert_category && details.expert_severity);
    alerts.push({
      id: incident.id,
      childId: incident.child_id,
      childName: childNameById.get(incident.child_id) ?? "הילד/ה",
      ...projectGuardianAssessment({
        category: hasExpertAssessment ? details.expert_category : incident.category,
        severity: hasExpertAssessment ? details.expert_severity : incident.severity,
        childRole: hasExpertAssessment ? details.expert_child_role : "unknown",
        confidence: hasExpertAssessment ? details.expert_confidence : incident.confidence,
      }, hasExpertAssessment, caseProjection),
      sourcePlatform: incident.source_platform,
      occurredAt: incident.occurred_at,
      summary: caseProjection?.safe_summary ?? analysis.safe_summary,
      reason: caseProjection?.safe_reason ?? analysis.safe_reason,
      recommendedAction: caseProjection?.recommended_action ?? analysis.recommended_action,
      state:
        state === "saved" || state === "acknowledged" ? state : "new",
      latestAssessmentAt: caseSummary?.latest_assessment_at ?? (caseProjection ? null : analysis.analyzed_at ?? null),
      attentionAssessmentSeq: caseSummary?.attention_assessment_seq ?? null,
      acknowledgedAssessmentSeq: caseSummary?.acknowledged_assessment_seq ?? null,
      acknowledgedAt: caseSummary ? caseSummary.acknowledged_at : storedState?.acknowledged_at ?? null,
      guardianStateVersion: caseSummary?.guardian_state_version ?? null,
      caseDetailsAvailable: caseSummary?.case_details_available === true,
      conversationLabel: caseSummary?.conversation_label ?? null,
      conversationType: caseSummary?.conversation_type === "private" || caseSummary?.conversation_type === "group"
        ? caseSummary.conversation_type : null,
      historyAssessmentCount: caseSummary?.history_assessment_count ?? null,
    });
  }

  alerts.sort((a, b) => Date.parse(b.latestAssessmentAt ?? b.occurredAt) - Date.parse(a.latestAssessmentAt ?? a.occurredAt));
  return { children, alerts };
}

function parseHistoryAssessment(value: unknown, throughSeq: number, afterSeq: number): V2GuardianAssessment {
  if (!value || typeof value !== "object") throw new Error("invalid_guardian_case_history");
  const row = value as Record<string, unknown>;
  if (!Number.isSafeInteger(row.assessment_seq) || Number(row.assessment_seq) <= afterSeq || Number(row.assessment_seq) > throughSeq ||
      typeof row.completed_at !== "string" || !Number.isFinite(Date.parse(row.completed_at)) ||
      !["confirmed", "dismissed", "inconclusive"].includes(String(row.expert_outcome)) ||
      [row.safe_summary, row.safe_reason, row.recommended_action].some(text => typeof text !== "string")) {
    throw new Error("invalid_guardian_case_history");
  }
  const confirmed = row.expert_outcome === "confirmed";
  if (confirmed && (typeof row.expert_category !== "string" || typeof row.expert_severity !== "string")) {
    throw new Error("invalid_guardian_case_history");
  }
  return {
    assessmentSeq: Number(row.assessment_seq), completedAt: row.completed_at,
    outcome: row.expert_outcome as GuardianExpertOutcome,
    category: confirmed ? row.expert_category as string : null,
    severity: confirmed ? row.expert_severity as string : null,
    childRole: confirmed && typeof row.expert_child_role === "string" ? row.expert_child_role : null,
    summary: row.safe_summary as string, reason: row.safe_reason as string, recommendedAction: row.recommended_action as string,
    recommendationIsHistorical: row.recommendation_is_historical === true,
    isAttentionUpdate: row.is_attention_update === true,
  };
}

export async function getV2GuardianAlertDetails(input: { familyId: string; incidentId: string }): Promise<{
  alert: V2GuardianAlert | null; history: V2GuardianAssessment[]; historyAvailable: boolean;
}> {
  if (!validIncidentId(input.incidentId)) return { alert: null, history: [], historyAvailable: false };
  const result = await loadGuardianAlerts(input);
  const alert = result.alerts.find(item => item.id === input.incidentId) ?? null;
  if (!alert?.caseDetailsAvailable || alert.assessmentSeq === null) return { alert, history: [], historyAvailable: false };
  // Each page uses the displayed snapshot's sequence. A later assessment arriving
  // between requests must not leak into this older view or be acknowledged by it.
  const history: V2GuardianAssessment[] = [];
  let afterSeq = 0;
  try {
    if (!Number.isSafeInteger(alert.historyAssessmentCount) || alert.historyAssessmentCount < 1) {
      throw new Error("invalid_guardian_case_history_snapshot");
    }
    while (true) {
      const { data, error } = await v2Supabase.rpc("v2_get_guardian_case_history", {
        target_incident_id: alert.id, target_through_seq: alert.assessmentSeq,
        target_expected_count: alert.historyAssessmentCount,
        target_after_seq: afterSeq, target_limit: 100,
      });
      if (error) throw error;
      const page = data?.[0];
      if (!page || page.incident_id !== alert.id || page.through_seq !== alert.assessmentSeq || !Array.isArray(page.assessments)) {
        throw new Error("invalid_guardian_case_history");
      }
      for (const value of page.assessments) {
        const item = parseHistoryAssessment(value, alert.assessmentSeq, afterSeq);
        history.push(item);
        afterSeq = item.assessmentSeq;
      }
      if (!page.has_more) break;
      if (page.assessments.length === 0 || page.next_after_seq !== afterSeq || afterSeq >= alert.assessmentSeq) {
        throw new Error("invalid_guardian_case_history_cursor");
      }
    }
    if (history.length !== alert.historyAssessmentCount || !history.some(item => item.assessmentSeq === alert.assessmentSeq)) {
      throw new Error("incomplete_guardian_case_history");
    }
    return { alert, history, historyAvailable: true };
  } catch {
    // A history outage must not hide the already authorized current alert. Never
    // present a partial history as complete or manufacture a result from its date.
    return { alert, history: [], historyAvailable: false };
  }
}

export async function setV2GuardianIncidentState(
  incidentId: string,
  state: V2GuardianIncidentState,
  expectedAssessmentSeq: number | null = null,
  expectedStateVersion: number | null = null,
): Promise<void> {
  if (expectedAssessmentSeq !== null) {
    if (expectedStateVersion === null) throw new Error("guardian_case_capability_unavailable");
    const { data, error } = await v2Supabase.rpc("v2_set_guardian_case_state", {
      target_incident_id: incidentId, target_state: state,
      target_expected_assessment_seq: expectedAssessmentSeq, target_expected_state_version: expectedStateVersion,
      target_request_key: requestKey(),
    });
    if (error) throw error;
    const result = data?.[0];
    if (!result || result.incident_id !== incidentId) throw new Error("invalid_guardian_case_state_receipt");
    // A replay reports the current state, which may already have reopened. Do
    // not announce that an old action handled a newly arrived assessment.
    if (result.assessment_seq !== expectedAssessmentSeq || result.state !== state) {
      throw { code: "23505", message: "guardian_assessment_version_conflict" };
    }
    return;
  }
  const { error } = await v2Supabase.rpc(
    "v2_set_guardian_incident_state",
    {
      target_incident_id: incidentId,
      target_state: state,
      target_request_key: requestKey(),
    },
  );
  if (error) throw error;
}
