import { v2Supabase } from "@/integrations/supabase/v2-client";
import type { Database as V2Database } from "@/integrations/supabase/v2-types";

type Tables = V2Database["public"]["Tables"];
type Incident = Tables["v2_safety_incidents"]["Row"];
type Analysis = Tables["v2_incident_analysis"]["Row"];
type GuardianState = Tables["v2_guardian_incident_states"]["Row"];

export type V2GuardianIncidentState = "new" | "saved" | "acknowledged";

export interface V2GuardianAlert {
  id: string;
  childId: string;
  childName: string;
  category: string;
  severity: string;
  childRole: string;
  confidence: number;
  sourcePlatform: string;
  occurredAt: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  guidanceAgeBand: string | null;
  guidanceCodes: string[];
  parentOpening: string | null;
  parentAvoid: string | null;
  parentNextAction: string | null;
  state: V2GuardianIncidentState;
}

const requestKey = () => `guardian-incident:${crypto.randomUUID()}`;

export async function getV2GuardianAlerts(input: {
  familyId: string;
  childId?: string | null;
}): Promise<{
  children: Array<{ id: string; displayName: string }>;
  alerts: V2GuardianAlert[];
}> {
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

  const { data: incidentData, error: incidentError } = await v2Supabase
    .from("v2_safety_incidents")
    .select("*")
    .in("child_id", scopedChildIds)
    .in("status", ["confirmed", "alerted"])
    .order("occurred_at", { ascending: false })
    .limit(250);
  if (incidentError) throw incidentError;

  const incidents = (incidentData ?? []) as Incident[];
  if (incidents.length === 0) return { children, alerts: [] };

  const incidentIds = incidents.map((incident) => incident.id);
  const [analysesResult, statesResult] = await Promise.all([
    v2Supabase
      .from("v2_incident_analysis")
      .select("*")
      .in("incident_id", incidentIds)
      .eq("outcome", "confirmed"),
    v2Supabase
      .from("v2_guardian_incident_states")
      .select("*")
      .in("incident_id", incidentIds),
  ]);
  if (analysesResult.error) throw analysesResult.error;
  if (statesResult.error) throw statesResult.error;

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
    const state = stateByIncident.get(incident.id)?.state;
    alerts.push({
      id: incident.id,
      childId: incident.child_id,
      childName: childNameById.get(incident.child_id) ?? "הילד/ה",
      category: incident.category,
      severity: incident.severity,
      childRole: incident.child_role,
      confidence: incident.confidence,
      sourcePlatform: incident.source_platform,
      occurredAt: incident.occurred_at,
      summary: analysis.safe_summary,
      reason: analysis.safe_reason,
      recommendedAction: analysis.recommended_action,
      guidanceAgeBand: analysis.guidance_age_band,
      guidanceCodes: analysis.guidance_codes,
      parentOpening: analysis.parent_opening,
      parentAvoid: analysis.parent_avoid,
      parentNextAction: analysis.parent_next_action,
      state:
        state === "saved" || state === "acknowledged" ? state : "new",
    });
  }

  return { children, alerts };
}

export async function setV2GuardianIncidentState(
  incidentId: string,
  state: V2GuardianIncidentState,
): Promise<void> {
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
