import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getFamilyParentIds } from "@/lib/familyScope";
import { isSystemApp } from "@/lib/appUtils";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

export interface NavBadgeCounts {
  home: number;
  alerts: number;
  chores: number;
}

/**
 * Aggregates counts that should appear as red badges on bottom-nav tabs:
 * - home: pending time requests + pending app approvals + permission issues + disconnected devices
 * - alerts: unacknowledged WhatsApp/AI alerts (only when monitoring is enabled)
 * - chores: chores completed by the child awaiting parent approval
 */
export function useNavBadgeCounts(): NavBadgeCounts {
  const { user } = useAuth();
  const userId = user?.id;
  const [counts, setCounts] = useState<NavBadgeCounts>({
    home: 0,
    alerts: 0,
    chores: 0,
  });

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setCounts({ home: 0, alerts: 0, chores: 0 });
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
        setCounts({ home: 0, alerts: 0, chores: 0 });
        return;
      }

      const [
        timeReqRes,
        installedRes,
        policiesRes,
        choresRes,
        alertsRes,
        thresholdRes,
        devicesRes,
      ] = await Promise.all([
        supabase
          .from("time_extension_requests")
          .select("id, child_id")
          .in("child_id", childIds)
          .eq("status", "pending"),
        supabase
          .from("installed_apps")
          .select("child_id, package_name, is_system")
          .in("child_id", childIds),
        supabase
          .from("app_policies")
          .select("child_id, package_name")
          .in("child_id", childIds),
        supabase
          .from("chores")
          .select("id, child_id, status")
          .in("child_id", childIds)
          .eq("status", "completed_by_child"),
        WHATSAPP_MONITORING_ENABLED
          ? supabase
              .from("alerts")
              .select("child_id, ai_risk_score, remind_at")
              .in("child_id", childIds)
              .is("acknowledged_at", null)
              .is("saved_at", null)
              .is("parent_message", null)
              .eq("is_processed", true)
              .eq("alert_type", "warning")
              .in("ai_verdict", ["notify", "review"])
          : Promise.resolve({ data: [] as any[] } as any),
        WHATSAPP_MONITORING_ENABLED
          ? supabase
              .from("settings")
              .select("child_id, alert_threshold")
              .in("child_id", childIds)
          : Promise.resolve({ data: [] as any[] } as any),
        supabase
          .from("devices")
          .select("child_id, last_seen")
          .in("child_id", childIds),
      ]);

      const policyKey = new Set(
        (policiesRes.data || []).map((p: any) => `${p.child_id}|${p.package_name}`)
      );
      const pendingApps = (installedRes.data || []).filter((a: any) => {
        if (policyKey.has(`${a.child_id}|${a.package_name}`)) return false;
        if (a.is_system) return false;
        if (isSystemApp(a.package_name)) return false;
        return true;
      }).length;

      const timeReqs = (timeReqRes.data || []).length;
      const choreApprovals = (choresRes.data || []).length;

      const thresholds: Record<string, number> = {};
      (thresholdRes.data || []).forEach((s: any) => {
        if (s.child_id) thresholds[s.child_id] = s.alert_threshold ?? 65;
      });
      const now = new Date();
      const alertsCount = (alertsRes.data || []).filter((a: any) => {
        const t = thresholds[a.child_id] ?? 65;
        return (
          (a.ai_risk_score ?? 0) >= t &&
          (!a.remind_at || new Date(a.remind_at) < now)
        );
      }).length;

      // Permission/disconnect signals via device last_seen (cheap signal for nav badge)
      const dayMs = 24 * 60 * 60 * 1000;
      const seenByChild = new Map<string, string | null>();
      (devicesRes.data || []).forEach((d: any) => {
        seenByChild.set(d.child_id, d.last_seen);
      });
      let disconnected = 0;
      childIds.forEach((cid) => {
        const ls = seenByChild.get(cid);
        if (!ls || Date.now() - new Date(ls).getTime() > dayMs) disconnected += 1;
      });

      setCounts({
        home: pendingApps + timeReqs + disconnected + choreApprovals,
        alerts: alertsCount,
        chores: choreApprovals,
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
        { event: "*", schema: "public", table: "time_extension_requests" },
        () => fetchAll()
      )
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
        { event: "*", schema: "public", table: "chores" },
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
