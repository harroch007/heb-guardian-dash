import { v2Supabase } from "@/integrations/supabase/v2-client";
import type { Database as V2Database, Json } from "@/integrations/supabase/v2-types";

type Tables = V2Database["public"]["Tables"];
type V2Child = Tables["v2_children"]["Row"];
type V2Device = Tables["v2_protected_devices"]["Row"];
type V2DeviceState = Tables["v2_parental_device_state"]["Row"];
type V2DeviceHealth = Tables["v2_device_health_events"]["Row"];
type V2Settings = Tables["v2_parental_settings"]["Row"];
type V2Schedule = Tables["v2_parental_schedules"]["Row"];

export interface V2GuardianHomeDevice {
  id: string;
  status: string;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  productReady: boolean | null;
  degradedReasons: string[];
  capabilities: Json;
}

export interface V2GuardianHomeChild {
  id: string;
  displayName: string;
  gender: string;
  device: V2GuardianHomeDevice | null;
  totalUsageMinutes: number;
  dailyLimitMinutes: number | null;
  todayBonusMinutes: number;
  confirmedIncidentCount: number;
  schedules: V2Schedule[];
}

const timestamp = (value: string | null) =>
  value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;

const newestDeviceByChild = (devices: V2Device[]) => {
  const result = new Map<string, V2Device>();
  for (const device of devices) {
    const existing = result.get(device.child_id);
    if (!existing || timestamp(device.last_seen_at) > timestamp(existing.last_seen_at)) {
      result.set(device.child_id, device);
    }
  }
  return result;
};

const newestHealthByDevice = (events: V2DeviceHealth[]) => {
  const result = new Map<string, V2DeviceHealth>();
  for (const event of events) {
    if (!result.has(event.device_id)) result.set(event.device_id, event);
  }
  return result;
};

/**
 * Parent-home read model backed only by the canonical V2 schema.
 *
 * RLS remains the authority. familyId is an additional client-side scope so a
 * parent screen never relies on broad table reads or legacy parent_id joins.
 */
export async function getV2GuardianHome(
  familyId: string,
  today: string,
): Promise<V2GuardianHomeChild[]> {
  const { data: childrenData, error: childrenError } = await v2Supabase
    .from("v2_children")
    .select("id, family_id, display_name, gender, birth_year, status, created_at, updated_at")
    .eq("family_id", familyId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (childrenError) throw childrenError;
  const children = (childrenData ?? []) as V2Child[];
  if (children.length === 0) return [];

  const childIds = children.map((child) => child.id);
  const [
    devicesResult,
    settingsResult,
    bonusResult,
    schedulesResult,
    incidentsResult,
  ] = await Promise.all([
    v2Supabase
      .from("v2_protected_devices")
      .select("*")
      .in("child_id", childIds)
      .neq("status", "revoked")
      .order("last_seen_at", { ascending: false }),
    v2Supabase
      .from("v2_parental_settings")
      .select("*")
      .in("child_id", childIds),
    v2Supabase
      .from("v2_parental_bonus_grants")
      .select("child_id, bonus_minutes")
      .in("child_id", childIds)
      .eq("grant_date", today),
    v2Supabase
      .from("v2_parental_schedules")
      .select("*")
      .in("child_id", childIds)
      .order("created_at", { ascending: true }),
    v2Supabase
      .from("v2_safety_incidents")
      .select("id, child_id")
      .in("child_id", childIds)
      .in("status", ["confirmed", "alerted"]),
  ]);

  const firstError = [
    devicesResult.error,
    settingsResult.error,
    bonusResult.error,
    schedulesResult.error,
    incidentsResult.error,
  ].find(Boolean);
  if (firstError) throw firstError;

  const devices = (devicesResult.data ?? []) as V2Device[];
  const devicesByChild = newestDeviceByChild(devices);
  const activeDeviceIds = [...devicesByChild.values()].map((device) => device.id);

  const statesByDevice = new Map<string, V2DeviceState>();
  const healthByDevice = new Map<string, V2DeviceHealth>();

  if (activeDeviceIds.length > 0) {
    const [statesResult, healthResult] = await Promise.all([
      v2Supabase
        .from("v2_parental_device_state")
        .select("*")
        .in("device_id", activeDeviceIds),
      v2Supabase
        .from("v2_device_health_events")
        .select("*")
        .in("device_id", activeDeviceIds)
        .eq("affects_current_state", true)
        .order("observed_at", { ascending: false }),
    ]);

    if (statesResult.error) throw statesResult.error;
    if (healthResult.error) throw healthResult.error;

    for (const state of (statesResult.data ?? []) as V2DeviceState[]) {
      statesByDevice.set(state.device_id, state);
    }
    for (const [deviceId, health] of newestHealthByDevice(
      (healthResult.data ?? []) as V2DeviceHealth[],
    )) {
      healthByDevice.set(deviceId, health);
    }
  }

  const settingsByChild = new Map(
    ((settingsResult.data ?? []) as V2Settings[]).map((settings) => [
      settings.child_id,
      settings,
    ]),
  );

  const bonusByChild = new Map<string, number>();
  for (const grant of bonusResult.data ?? []) {
    bonusByChild.set(
      grant.child_id,
      (bonusByChild.get(grant.child_id) ?? 0) + grant.bonus_minutes,
    );
  }

  const schedulesByChild = new Map<string, V2Schedule[]>();
  for (const schedule of (schedulesResult.data ?? []) as V2Schedule[]) {
    const existing = schedulesByChild.get(schedule.child_id) ?? [];
    existing.push(schedule);
    schedulesByChild.set(schedule.child_id, existing);
  }

  const incidents = incidentsResult.data ?? [];
  const nonNewIncidentIds = new Set<string>();
  if (incidents.length > 0) {
    const { data: incidentStates, error: incidentStatesError } =
      await v2Supabase
        .from("v2_guardian_incident_states")
        .select("incident_id, state")
        .in(
          "incident_id",
          incidents.map((incident) => incident.id),
        )
        .in("state", ["saved", "acknowledged"]);
    if (incidentStatesError) throw incidentStatesError;
    for (const state of incidentStates ?? []) {
      nonNewIncidentIds.add(state.incident_id);
    }
  }

  const incidentsByChild = new Map<string, number>();
  for (const incident of incidents) {
    if (nonNewIncidentIds.has(incident.id)) continue;
    incidentsByChild.set(
      incident.child_id,
      (incidentsByChild.get(incident.child_id) ?? 0) + 1,
    );
  }

  return children.map((child) => {
    const device = devicesByChild.get(child.id) ?? null;
    const state = device ? statesByDevice.get(device.id) ?? null : null;
    const health = device ? healthByDevice.get(device.id) ?? null : null;
    const settings = settingsByChild.get(child.id) ?? null;

    return {
      id: child.id,
      displayName: child.display_name,
      gender: child.gender,
      device: device
        ? {
            id: device.id,
            status: device.status,
            batteryLevel: health?.battery_level_percent ?? null,
            lastSeenAt: device.last_seen_at,
            address: state?.location_address ?? null,
            latitude: state?.latitude ?? null,
            longitude: state?.longitude ?? null,
            productReady: health?.product_ready ?? null,
            degradedReasons: health?.degraded_reasons ?? [],
            capabilities: health?.capabilities ?? {},
          }
        : null,
      totalUsageMinutes:
        state?.usage_date === today ? state.total_screen_minutes ?? 0 : 0,
      dailyLimitMinutes:
        settings?.daily_screen_time_limit_minutes ?? null,
      todayBonusMinutes: bonusByChild.get(child.id) ?? 0,
      confirmedIncidentCount: incidentsByChild.get(child.id) ?? 0,
      schedules: schedulesByChild.get(child.id) ?? [],
    };
  });
}
