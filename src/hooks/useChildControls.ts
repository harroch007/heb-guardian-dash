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

interface PendingCommand {
  id: string;
  status: string;
  created_at: string;
}

export function useChildControls(childId: string | undefined) {
  const { user } = useAuth();
  const [appPolicies, setAppPolicies] = useState<AppPolicy[]>([]);
  const [blockedAttempts, setBlockedAttempts] = useState<BlockedAttemptSummary[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealthInfo | null>(null);
  const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!childId || !user) return;

    // Fetch all data in parallel
    const [policiesRes, attemptsRes, heartbeatRes, commandsRes] = await Promise.all([
      // App policies
      supabase
        .from("app_policies")
        .select("*")
        .eq("child_id", childId)
        .order("app_name"),

      // Blocked attempts today
      supabase
        .from("blocked_app_attempts")
        .select("package_name, attempted_at")
        .eq("child_id", childId)
        .gte("attempted_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),

      // Latest heartbeat for device health
      supabase
        .from("devices")
        .select("device_id")
        .eq("child_id", childId)
        .order("last_seen", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Pending REFRESH_SETTINGS commands
      supabase
        .from("device_commands")
        .select("id, status, created_at")
        .eq("command_type", "REFRESH_SETTINGS")
        .in("status", ["PENDING", "ACKNOWLEDGED"])
        .order("created_at", { ascending: false }),
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

    // Fetch heartbeat if device exists
    if (heartbeatRes.data?.device_id) {
      const deviceId = heartbeatRes.data.device_id;
      
      // Filter commands for this device
      if (commandsRes.data) {
        const deviceCommands = commandsRes.data.filter((cmd: any) => true); // all REFRESH_SETTINGS
        setPendingCommands(deviceCommands as PendingCommand[]);
      }

      const { data: hbData } = await supabase
        .from("device_heartbeats_raw")
        .select("permissions, device, reported_at")
        .eq("device_id", deviceId)
        .order("reported_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hbData) {
        const device = hbData.device as Record<string, any>;
        const permissions = hbData.permissions as Record<string, boolean>;
        setDeviceHealth({
          permissions: permissions || {},
          deviceVersion: device?.appVersionName || null,
          deviceModel: device?.model || null,
          reportedAt: hbData.reported_at,
        });
      }
    }

    setLoading(false);
  }, [childId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAppBlock = async (packageName: string, appName: string | null, currentlyBlocked: boolean) => {
    if (!childId || !user) return;

    const newBlocked = !currentlyBlocked;

    // Upsert app policy
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

    // Send REFRESH_SETTINGS to all active devices of this child
    const { data: devices } = await supabase
      .from("devices")
      .select("device_id")
      .eq("child_id", childId);

    if (devices) {
      for (const dev of devices) {
        await supabase.from("device_commands").insert({
          device_id: dev.device_id,
          command_type: "REFRESH_SETTINGS",
          status: "PENDING",
        });
      }
    }

    toast.success(newBlocked ? "האפליקציה נחסמה" : "האפליקציה שוחררה");
    fetchData();
  };

  const updateDailyLimit = async (minutes: number | null) => {
    if (!childId || !user) return;

    // Find or create settings for this child
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

    // Send REFRESH_SETTINGS
    const { data: devices } = await supabase
      .from("devices")
      .select("device_id")
      .eq("child_id", childId);

    if (devices) {
      for (const dev of devices) {
        await supabase.from("device_commands").insert({
          device_id: dev.device_id,
          command_type: "REFRESH_SETTINGS",
          status: "PENDING",
        });
      }
    }

    toast.success(minutes ? "מגבלת זמן מסך עודכנה" : "מגבלת זמן מסך הוסרה");
  };

  return {
    appPolicies,
    blockedAttempts,
    deviceHealth,
    pendingCommands,
    loading,
    toggleAppBlock,
    updateDailyLimit,
    refetch: fetchData,
  };
}
