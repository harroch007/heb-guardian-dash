import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { isSystemApp } from "@/lib/appUtils";

export interface NavBadgeCounts {
  home: number;
  alerts: number;
}

const lastSeenValue = (value: string | null) =>
  value ? new Date(value).getTime() : Number.NEGATIVE_INFINITY;

/**
 * Badge counts for active V2 navigation only.
 *
 * Child time requests are intentionally absent. Home attention combines
 * confirmed safety incidents with parental-control and device-health issues.
 */
export function useV2NavBadgeCounts(): NavBadgeCounts {
  const { familyId } = useAuth();
  const [counts, setCounts] = useState<NavBadgeCounts>({
    home: 0,
    alerts: 0,
  });

  const fetchAll = useCallback(async () => {
    if (!familyId) {
      setCounts({ home: 0, alerts: 0 });
      return;
    }

    try {
      const { data: children, error: childrenError } = await v2Supabase
        .from("v2_children")
        .select("id")
        .eq("family_id", familyId)
        .eq("status", "active");
      if (childrenError) throw childrenError;

      const childIds = (children || []).map((child) => child.id);
      if (childIds.length === 0) {
        setCounts({ home: 0, alerts: 0 });
        return;
      }

      const [devicesResult, policiesResult, incidentsResult] =
        await Promise.all([
          v2Supabase
            .from("v2_protected_devices")
            .select("id, child_id, last_seen_at")
            .in("child_id", childIds)
            .neq("status", "revoked")
            .order("last_seen_at", { ascending: false }),
          v2Supabase
            .from("v2_parental_app_policies")
            .select("child_id, package_name")
            .in("child_id", childIds),
          v2Supabase
            .from("v2_safety_incidents")
            .select("id")
            .in("child_id", childIds)
            .in("status", ["confirmed", "alerted"]),
        ]);

      const firstError = [
        devicesResult.error,
        policiesResult.error,
        incidentsResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const newestDeviceByChild = new Map<
        string,
        { id: string; child_id: string; last_seen_at: string | null }
      >();
      for (const device of devicesResult.data || []) {
        const existing = newestDeviceByChild.get(device.child_id);
        if (
          !existing ||
          lastSeenValue(device.last_seen_at) >
            lastSeenValue(existing.last_seen_at)
        ) {
          newestDeviceByChild.set(device.child_id, device);
        }
      }

      const activeDevices = [...newestDeviceByChild.values()];
      const activeDeviceIds = activeDevices.map((device) => device.id);

      let pendingApps = 0;
      let recentGeofenceEvents = 0;
      let degradedDevices = 0;

      if (activeDeviceIds.length > 0) {
        const since = new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();
        const [installedResult, geofenceResult, healthResult] =
          await Promise.all([
            v2Supabase
              .from("v2_parental_installed_apps")
              .select("device_id, package_name, is_system")
              .in("device_id", activeDeviceIds)
              .eq("is_installed", true),
            v2Supabase
              .from("v2_parental_geofence_events")
              .select("id")
              .in("device_id", activeDeviceIds)
              .gte("occurred_at", since),
            v2Supabase
              .from("v2_device_health_events")
              .select("device_id, product_ready, observed_at")
              .in("device_id", activeDeviceIds)
              .eq("affects_current_state", true)
              .order("observed_at", { ascending: false }),
          ]);

        const detailError = [
          installedResult.error,
          geofenceResult.error,
          healthResult.error,
        ].find(Boolean);
        if (detailError) throw detailError;

        const childByDevice = new Map(
          activeDevices.map((device) => [device.id, device.child_id]),
        );
        const policyKey = new Set(
          (policiesResult.data || []).map(
            (policy) => `${policy.child_id}|${policy.package_name}`,
          ),
        );
        pendingApps = (installedResult.data || []).filter((app) => {
          const childId = childByDevice.get(app.device_id);
          if (!childId) return false;
          if (policyKey.has(`${childId}|${app.package_name}`)) return false;
          if (app.is_system || isSystemApp(app.package_name)) return false;
          return true;
        }).length;

        recentGeofenceEvents = (geofenceResult.data || []).length;

        const healthByDevice = new Map<string, boolean | null>();
        for (const health of healthResult.data || []) {
          if (!healthByDevice.has(health.device_id)) {
            healthByDevice.set(health.device_id, health.product_ready);
          }
        }
        degradedDevices = activeDeviceIds.filter(
          (deviceId) => healthByDevice.get(deviceId) === false,
        ).length;
      }

      const staleAfterMs = 24 * 60 * 60 * 1000;
      const disconnected = childIds.filter((childId) => {
        const device = newestDeviceByChild.get(childId);
        return (
          !device?.last_seen_at ||
          Date.now() - new Date(device.last_seen_at).getTime() > staleAfterMs
        );
      }).length;

      const incidents = incidentsResult.data || [];
      let newIncidentCount = incidents.length;
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
        newIncidentCount = Math.max(
          0,
          incidents.length - (incidentStates?.length ?? 0),
        );
      }

      setCounts({
        home:
          newIncidentCount +
          pendingApps +
          recentGeofenceEvents +
          degradedDevices +
          disconnected,
        alerts: newIncidentCount,
      });
    } catch (error) {
      console.error("[navigation] Failed to load V2 badge counts", error);
    }
  }, [familyId]);

  useEffect(() => {
    void fetchAll();
    if (!familyId) return;

    const channel = v2Supabase
      .channel(`v2-nav-badges-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_protected_devices" },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_installed_apps" },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_app_policies" },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_geofence_events" },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_device_health_events" },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_safety_incidents" },
        () => void fetchAll(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "v2_guardian_incident_states",
        },
        () => void fetchAll(),
      )
      .subscribe();

    const onFocus = () => void fetchAll();
    window.addEventListener("focus", onFocus);
    return () => {
      void v2Supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [familyId, fetchAll]);

  return counts;
}
