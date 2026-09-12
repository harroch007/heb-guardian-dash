import { useEffect, useState } from "react";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { isSystemApp } from "@/lib/appUtils";

export function usePendingAppCounts(childIds: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const childIdsKey = childIds.join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = childIdsKey ? childIdsKey.split(",") : [];

    const fetchCounts = async () => {
      if (ids.length === 0) {
        if (!cancelled) setCounts({});
        return;
      }

      const [devicesRes, policiesRes] = await Promise.all([
        v2Supabase
          .from("v2_protected_devices")
          .select("id, child_id")
          .in("child_id", ids)
          .neq("status", "revoked"),
        v2Supabase
          .from("v2_parental_app_policies")
          .select("child_id, package_name")
          .in("child_id", ids),
      ]);

      if (devicesRes.error || policiesRes.error) {
        if (!cancelled) setCounts({});
        return;
      }

      const childByDevice = new Map(
        (devicesRes.data || []).map((device) => [device.id, device.child_id]),
      );
      const deviceIds = [...childByDevice.keys()];
      if (deviceIds.length === 0) {
        if (!cancelled) setCounts({});
        return;
      }

      const { data: installed, error } = await v2Supabase
        .from("v2_parental_installed_apps")
        .select("device_id, package_name, is_system")
        .in("device_id", deviceIds)
        .eq("is_installed", true);

      if (error) {
        if (!cancelled) setCounts({});
        return;
      }

      const policyKey = new Set(
        (policiesRes.data || []).map((p) => `${p.child_id}|${p.package_name}`),
      );

      const next: Record<string, number> = {};
      for (const app of installed || []) {
        const childId = childByDevice.get(app.device_id);
        if (!childId) continue;
        if (app.is_system) continue;
        if (isSystemApp(app.package_name)) continue;
        if (policyKey.has(`${childId}|${app.package_name}`)) continue;
        next[childId] = (next[childId] || 0) + 1;
      }

      if (!cancelled) setCounts(next);
    };

    void fetchCounts();

    if (ids.length === 0) return () => { cancelled = true; };

    const channel = v2Supabase
      .channel("attention-pending-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_installed_apps" },
        () => void fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "v2_parental_app_policies" },
        () => void fetchCounts(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      v2Supabase.removeChannel(channel);
    };
  }, [childIdsKey]);

  return counts;
}
