import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AppPolicy {
  id: string;
  child_id: string;
  package_name: string;
  app_name: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
}

export interface BlockedAttemptSummary {
  package_name: string;
  attempts_today: number;
  last_attempt: string | null;
}

export interface DeviceHealthInfo {
  permissions: Record<string, boolean>;
  deviceVersion: string | null;
  deviceModel: string | null;
  reportedAt: string | null;
}

export interface DeviceCommand {
  id: string;
  status: string;
  device_id: string;
  result: string | null;
  created_at: string;
}

export function useChildControls(childId: string | undefined) {
  const { user } = useAuth();
  const [appPolicies, setAppPolicies] = useState<AppPolicy[]>([]);
  const [blockedAttempts, setBlockedAttempts] = useState<BlockedAttemptSummary[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealthInfo | null>(null);
  const [recentCommands, setRecentCommands] = useState<DeviceCommand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!childId || !user) return;

    // Step 1: Fetch policies, attempts, devices, and health in parallel
    const [policiesRes, attemptsRes, devicesRes, healthRes] = await Promise.all([
      supabase
        .from("app_policies")
        .select("*")
        .eq("child_id", childId)
        .order("app_name"),

      supabase
        .from("blocked_app_attempts")
        .select("package_name, attempted_at")
        .eq("child_id", childId)
        .gte("attempted_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

      supabase
        .from("devices")
        .select("device_id")
        .eq("child_id", childId),

      // Gap 1 fix: use RPC instead of direct heartbeat query
      supabase.rpc("get_child_device_health", { p_child_id: childId }),
    ]);

    if (policiesRes.data) {
      setAppPolicies(policiesRes.data as AppPolicy[]);
    }

    // Aggregate attempts by package_name
    if (attemptsRes.data) {
      const attemptsMap = new Map<string, { count: number; last: string }>();
      for (const row of attemptsRes.data) {
        const existing = attemptsMap.get(row.package_name);
        if (existing) {
          existing.count++;
          if (row.attempted_at > existing.last) existing.last = row.attempted_at;
        } else {
          attemptsMap.set(row.package_name, { count: 1, last: row.attempted_at });
        }
      }
      setBlockedAttempts(
        Array.from(attemptsMap.entries()).map(([pkg, data]) => ({
          package_name: pkg,
          attempts_today: data.count,
          last_attempt: data.last,
        }))
      );
    }

    // Gap 1 fix: parse RPC result for device health
    if (healthRes.data) {
      const hb = healthRes.data as Record<string, any>;
      const device = hb.device as Record<string, any> | null;
      const permissions = hb.permissions as Record<string, boolean> | null;
      setDeviceHealth({
        permissions: permissions || {},
        deviceVersion: device?.appVersionName || null,
        deviceModel: device?.model || null,
        reportedAt: hb.reported_at || null,
      });
    } else {
      setDeviceHealth(null);
    }

    // Gap 2 fix: fetch commands scoped to child's devices only
    const childDeviceIds = devicesRes.data?.map((d) => d.device_id) || [];
    if (childDeviceIds.length > 0) {
      const { data: commandsData } = await supabase
        .from("device_commands")
        .select("id, status, device_id, result, created_at")
        .eq("command_type", "REFRESH_SETTINGS")
        .in("device_id", childDeviceIds)
        .in("status", ["PENDING", "ACKNOWLEDGED", "FAILED", "TIMED_OUT"])
        .order("created_at", { ascending: false })
        .limit(10);

      setRecentCommands((commandsData as DeviceCommand[]) || []);
    } else {
      setRecentCommands([]);
    }

    setLoading(false);
  }, [childId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sendRefreshToAllDevices = async () => {
    const { data: devices } = await supabase
      .from("devices")
      .select("device_id")
      .eq("child_id", childId!);

    if (devices) {
      for (const dev of devices) {
        await supabase.from("device_commands").insert({
          device_id: dev.device_id,
          command_type: "REFRESH_SETTINGS",
          status: "PENDING",
        });
      }
    }
  };

  const toggleAppBlock = async (packageName: string, appName: string | null, currentlyBlocked: boolean) => {
    if (!childId || !user) return;

    const newBlocked = !currentlyBlocked;

    const { error } = await supabase
      .from("app_policies")
      .upsert(
        {
          child_id: childId,
          package_name: packageName,
          app_name: appName,
          is_blocked: newBlocked,
          blocked_at: newBlocked ? new Date().toISOString() : null,
          blocked_by: newBlocked ? user.id : null,
        },
        { onConflict: "child_id,package_name" }
      );

    if (error) {
      toast.error("שגיאה בעדכון מדיניות האפליקציה");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success(newBlocked ? "האפליקציה נחסמה" : "האפליקציה שוחררה");
    fetchData();
  };

  const updateDailyLimit = async (minutes: number | null) => {
    if (!childId || !user) return;

    const { data: existing } = await supabase
      .from("settings")
      .select("id")
      .eq("child_id", childId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("settings")
        .update({ daily_screen_time_limit_minutes: minutes })
        .eq("id", existing.id);
    } else {
      await supabase.from("settings").insert({
        child_id: childId,
        parent_id: user.id,
        daily_screen_time_limit_minutes: minutes,
      });
    }

    await sendRefreshToAllDevices();
    toast.success(minutes ? "מגבלת זמן מסך עודכנה" : "מגבלת זמן מסך הוסרה");
  };

  return {
    appPolicies,
    blockedAttempts,
    deviceHealth,
    recentCommands,
    loading,
    toggleAppBlock,
    updateDailyLimit,
    refetch: fetchData,
  };
}
