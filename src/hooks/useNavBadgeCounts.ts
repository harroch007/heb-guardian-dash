import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getFamilyParentIds } from "@/lib/familyScope";
import { isSystemApp } from "@/lib/appUtils";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

export interface NavBadgeCounts {
  home: number;
  alerts: number;
}

/**
 * Aggregates counts that should appear as red badges on bottom-nav tabs:
 * - home: pending app approvals + permission issues + disconnected devices
 * - alerts: unacknowledged WhatsApp/AI alerts (only when monitoring is enabled)
 */
export function useNavBadgeCounts(): NavBadgeCounts {
  const { user } = useAuth();
  const userId = user?.id;
  const [counts, setCounts] = useState<NavBadgeCounts>({
    home: 0,
    alerts: 0,
  });

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setCounts({ home: 0, alerts: 0 });
      return;
    }
    try {
      const allowed = await getFamilyParentIds(userId);
      const { data: children } = await supabase
        .from("children")
        .select("id")
        .in("parent_id", allowed);
      const childIds = (children || []).map((c) => c.id);
      if (childIds.length === 0) {
        setCounts({ home: 0, alerts: 0 });
        return;
      }

      const [
        installedRes,
        policiesRes,
        alertsRes,
        thresholdRes,
        devicesRes,
        geofenceRes,
      ] = await Promise.all([
        supabase
          .from("installed_apps")
          .select("child_id, package_name, is_system")
          .in("child_id", childIds),
        supabase
          .from("app_policies")
          .select("child_id, package_name")
          .in("child_id", childIds),
        supabase
          .from("alerts")
          .select("child_id, ai_risk_score, remind_at")
          .in("child_id", childIds)
          .is("acknowledged_at", null)
          .is("saved_at", null)
          .is("parent_message", null)
          .eq("is_processed", true)
          .eq("alert_type", "warning")
          .in("ai_verdict", ["notify", "review"]),
        supabase
          .from("settings")
          .select("child_id, alert_threshold")
          .in("child_id", childIds),
        supabase
          .from("devices")
          .select("child_id, last_seen")
          .in("child_id", childIds),
        supabase
          .from("alerts")
          .select("id, child_id")
          .in("child_id", childIds)
          .eq("category", "geofence")
          .is("acknowledged_at", null)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const policyKey = new Set(
        (policiesRes.data || []).map((policy) => `${policy.child_id}|${policy.package_name}`)
      );
      const pendingApps = (installedRes.data || []).filter((app) => {
        if (policyKey.has(`${app.child_id}|${app.package_name}`)) return false;
        if (app.is_system) return false;
        if (isSystemApp(app.package_name)) return false;
        return true;
      }).length;

      const thresholds: Record<string, number> = {};
      (thresholdRes.data || []).forEach((setting) => {
        if (setting.child_id) thresholds[setting.child_id] = setting.alert_threshold ?? 65;
      });
      const now = new Date();
      const alertsCount = WHATSAPP_MONITORING_ENABLED
        ? (alertsRes.data || []).filter((alert) => {
            const threshold = thresholds[alert.child_id] ?? 65;
            return (
              (alert.ai_risk_score ?? 0) >= threshold &&
              (!alert.remind_at || new Date(alert.remind_at) < now)
            );
          }).length
        : 0;

      // Permission/disconnect signals via device last_seen (cheap signal for nav badge)
      const dayMs = 24 * 60 * 60 * 1000;
      const seenByChild = new Map<string, string | null>();
      (devicesRes.data || []).forEach((device) => {
        seenByChild.set(device.child_id, device.last_seen);
      });
      let disconnected = 0;
      childIds.forEach((cid) => {
        const ls = seenByChild.get(cid);
        if (!ls || Date.now() - new Date(ls).getTime() > dayMs) disconnected += 1;
      });

      const geofenceCount = (geofenceRes.data || []).length;

      setCounts({
        home: pendingApps + disconnected + geofenceCount,
        alerts: alertsCount,
      });
    } catch {
      // best-effort badge counts
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
    if (!userId) return;
    const channel = supabase
      .channel(`nav-badges-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "installed_apps" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_policies" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => fetchAll()
      )
      .subscribe();
    // refresh when window regains focus
    const onFocus = () => fetchAll();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, fetchAll]);

  return counts;
}
