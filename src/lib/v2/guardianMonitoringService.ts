import { v2Supabase } from "@/integrations/supabase/v2-client";
import type {
  Database as V2Database,
  Json,
} from "@/integrations/supabase/v2-types";

type Tables = V2Database["public"]["Tables"];
type V2Child = Tables["v2_children"]["Row"];
type V2Device = Tables["v2_protected_devices"]["Row"];
type V2DeviceHealth = Tables["v2_device_health_events"]["Row"];
type V2MonitoringState = Tables["v2_device_monitoring_state"]["Row"];

export type GuardianMonitoringState =
  | "healthy"
  | "late"
  | "interrupted"
  | "needs_setup"
  | "unknown";

export interface GuardianMonitoringDevice {
  id: string;
  status: string;
  manufacturer: string | null;
  model: string | null;
  appVersion: string;
  lastSeenAt: string | null;
  healthObservedAt: string | null;
  batteryLevel: number | null;
  monitoringState: GuardianMonitoringState;
  captureReady: boolean;
  productReady: boolean;
  accessibilityEnabled: boolean;
  notificationListenerEnabled: boolean;
  appNotificationsAllowed: boolean;
  batteryOptimizationExempt: boolean;
  degradedReasons: string[];
  reasonCodes: string[];
}

export interface GuardianMonitoringChild {
  id: string;
  displayName: string;
  gender: string;
  birthYear: number | null;
  device: GuardianMonitoringDevice | null;
  newIncidentCount: number;
}

const timestamp = (value: string | null) =>
  value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;

const newestDeviceByChild = (devices: V2Device[]) => {
  const result = new Map<string, V2Device>();
  for (const device of devices) {
    const existing = result.get(device.child_id);
    if (
      !existing ||
      timestamp(device.last_seen_at) > timestamp(existing.last_seen_at)
    ) {
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

const capabilitySatisfied = (capabilities: Json, key: string) => {
  if (
    !capabilities ||
    Array.isArray(capabilities) ||
    typeof capabilities !== "object"
  ) {
    return false;
  }
  const value = capabilities[key];
  return Boolean(
    value &&
      !Array.isArray(value) &&
      typeof value === "object" &&
      value.state === "satisfied",
  );
};

const normalizeMonitoringState = (
  state: string | null | undefined,
  health: V2DeviceHealth | null,
): GuardianMonitoringState => {
  if (state === "healthy" || state === "active") return "healthy";
  if (state === "late") return "late";
  if (state === "interrupted") return "interrupted";
  if (health?.capture_ready && health.product_ready !== false) return "healthy";
  if (health && !health.capture_ready) return "needs_setup";
  return "unknown";
};

/**
 * Guardian-safe read model for the current WhatsApp monitoring release.
 *
 * It intentionally does not read screen-time, apps, schedules, location,
 * geofences or child-message buffers. RLS remains the authorization boundary.
 */
export async function getV2GuardianMonitoring(
  familyId: string,
): Promise<GuardianMonitoringChild[]> {
  const { data: childrenData, error: childrenError } = await v2Supabase
    .from("v2_children")
    .select(
      "id, family_id, display_name, gender, birth_year, status, created_at, updated_at",
    )
    .eq("family_id", familyId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (childrenError) throw childrenError;
  const children = (childrenData ?? []) as V2Child[];
  if (children.length === 0) return [];

  const childIds = children.map((child) => child.id);
  const [devicesResult, incidentsResult] = await Promise.all([
    v2Supabase
      .from("v2_protected_devices")
      .select("*")
      .in("child_id", childIds)
      .neq("status", "revoked")
      .order("last_seen_at", { ascending: false }),
    v2Supabase
      .from("v2_safety_incidents")
      .select("id, child_id")
      .in("child_id", childIds)
      .in("status", ["confirmed", "alerted"]),
  ]);

  if (devicesResult.error) throw devicesResult.error;
  if (incidentsResult.error) throw incidentsResult.error;

  const devices = (devicesResult.data ?? []) as V2Device[];
  const devicesByChild = newestDeviceByChild(devices);
  const activeDeviceIds = [...devicesByChild.values()].map(
    (device) => device.id,
  );
  const healthByDevice = new Map<string, V2DeviceHealth>();
  const monitoringByDevice = new Map<string, V2MonitoringState>();

  if (activeDeviceIds.length > 0) {
    const [healthResult, monitoringResult] = await Promise.all([
      v2Supabase
        .from("v2_device_health_events")
        .select("*")
        .in("device_id", activeDeviceIds)
        .eq("affects_current_state", true)
        .order("observed_at", { ascending: false }),
      v2Supabase
        .from("v2_device_monitoring_state")
        .select("*")
        .in("device_id", activeDeviceIds),
    ]);

    if (healthResult.error) throw healthResult.error;
    if (monitoringResult.error) throw monitoringResult.error;

    for (const [deviceId, health] of newestHealthByDevice(
      (healthResult.data ?? []) as V2DeviceHealth[],
    )) {
      healthByDevice.set(deviceId, health);
    }
    for (const state of (monitoringResult.data ?? []) as V2MonitoringState[]) {
      monitoringByDevice.set(state.device_id, state);
    }
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
    const health = device ? healthByDevice.get(device.id) ?? null : null;
    const monitoring = device
      ? monitoringByDevice.get(device.id) ?? null
      : null;

    return {
      id: child.id,
      displayName: child.display_name,
      gender: child.gender,
      birthYear: child.birth_year,
      device: device
        ? {
            id: device.id,
            status: device.status,
            manufacturer: device.manufacturer,
            model: device.model,
            appVersion: device.app_version,
            lastSeenAt: device.last_seen_at,
            healthObservedAt: health?.observed_at ?? null,
            batteryLevel: health?.battery_level_percent ?? null,
            monitoringState: normalizeMonitoringState(
              monitoring?.monitoring_state,
              health,
            ),
            captureReady: health?.capture_ready ?? false,
            productReady: health?.product_ready ?? false,
            accessibilityEnabled: health?.accessibility_enabled ?? false,
            notificationListenerEnabled:
              health?.notification_listener_enabled ?? false,
            appNotificationsAllowed: health
              ? capabilitySatisfied(
                  health.capabilities,
                  "app_notifications_allowed",
                )
              : false,
            batteryOptimizationExempt:
              health?.battery_optimization_exempt ?? false,
            degradedReasons: health?.degraded_reasons ?? [],
            reasonCodes: monitoring?.reason_codes ?? [],
          }
        : null,
      newIncidentCount: incidentsByChild.get(child.id) ?? 0,
    };
  });
}
