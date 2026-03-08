import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getIsraelDate } from "@/lib/utils";

export interface AppPolicy {
  id: string;
  child_id: string;
  package_name: string;
  app_name: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
  policy_status: "approved" | "blocked";
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

export interface InstalledApp {
  id: string;
  child_id: string;
  package_name: string;
  app_name: string | null;
  is_system: boolean;
  category: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ScheduleWindow {
  id: string;
  child_id: string;
  name: string;
  schedule_type: string;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  mode: string;
  manual_start_time: string | null;
  manual_end_time: string | null;
}

export interface NextShabbat {
  friday_date: string;
  candle_lighting: string;
  havdalah: string;
}

export function useChildControls(childId: string | undefined) {
  const { user } = useAuth();
  const [appPolicies, setAppPolicies] = useState<AppPolicy[]>([]);
  const [blockedAttempts, setBlockedAttempts] = useState<BlockedAttemptSummary[]>([]);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealthInfo | null>(null);
  const [recentCommands, setRecentCommands] = useState<DeviceCommand[]>([]);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [scheduleWindows, setScheduleWindows] = useState<ScheduleWindow[]>([]);
  const [nextShabbat, setNextShabbat] = useState<NextShabbat | null>(null);
  const [todayBonusMinutes, setTodayBonusMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!childId || !user) return;

    const today = new Date().toISOString().split("T")[0];
    const todayIsrael = getIsraelDate();

    const [policiesRes, attemptsRes, devicesRes, healthRes, installedRes, schedulesRes, shabbatRes, bonusRes] = await Promise.all([
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

      supabase.rpc("get_child_device_health", { p_child_id: childId }),

      supabase
        .from("installed_apps")
        .select("*")
        .eq("child_id", childId)
        .eq("is_system", false)
        .order("app_name"),

      supabase
        .from("schedule_windows")
        .select("*")
        .eq("child_id", childId),

      supabase
        .from("shabbat_zmanim")
        .select("friday_date, candle_lighting, havdalah")
        .gte("friday_date", today)
        .order("friday_date")
        .limit(1),

      supabase
        .from("bonus_time_grants")
        .select("bonus_minutes")
        .eq("child_id", childId)
        .eq("grant_date", todayIsrael),
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

    // Device health
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

    // Installed apps
    setInstalledApps((installedRes.data as InstalledApp[]) || []);

    // Schedule windows
    setScheduleWindows((schedulesRes.data as ScheduleWindow[]) || []);

    // Next shabbat
    if (shabbatRes.data && shabbatRes.data.length > 0) {
      setNextShabbat(shabbatRes.data[0] as NextShabbat);
    } else {
      setNextShabbat(null);
    }

    // Today's bonus
    if (bonusRes.data) {
      const total = bonusRes.data.reduce((sum: number, r: any) => sum + (r.bonus_minutes || 0), 0);
      setTodayBonusMinutes(total);
    } else {
      setTodayBonusMinutes(0);
    }

    // Commands scoped to child's devices only
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
          policy_status: newBlocked ? "blocked" : "approved",
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

  /** Approve a pending app — creates policy row with approved status */
  const approveApp = async (packageName: string, appName: string | null) => {
    if (!childId || !user) return;

    const { error } = await supabase
      .from("app_policies")
      .upsert(
        {
          child_id: childId,
          package_name: packageName,
          app_name: appName,
          is_blocked: false,
          policy_status: "approved",
          blocked_at: null,
          blocked_by: null,
        },
        { onConflict: "child_id,package_name" }
      );

    if (error) {
      toast.error("שגיאה באישור האפליקציה");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success("האפליקציה אושרה");
    fetchData();
  };

  /** Block a pending app — creates policy row with blocked status */
  const blockApp = async (packageName: string, appName: string | null) => {
    if (!childId || !user) return;

    const { error } = await supabase
      .from("app_policies")
      .upsert(
        {
          child_id: childId,
          package_name: packageName,
          app_name: appName,
          is_blocked: true,
          policy_status: "blocked",
          blocked_at: new Date().toISOString(),
          blocked_by: user.id,
        },
        { onConflict: "child_id,package_name" }
      );

    if (error) {
      toast.error("שגיאה בחסימת האפליקציה");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success("האפליקציה נחסמה");
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

  /** Grant bonus time for today (Israel TZ) */
  const grantBonusTime = async (minutes: number) => {
    if (!childId || !user) return;

    const todayIsrael = getIsraelDate();

    const { error } = await supabase
      .from("bonus_time_grants")
      .insert({
        child_id: childId,
        grant_date: todayIsrael,
        bonus_minutes: minutes,
        granted_by: user.id,
      });

    if (error) {
      toast.error("שגיאה בהוספת זמן בונוס");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success(`נוסף זמן בונוס של ${minutes} דקות להיום`);
    fetchData();
  };

  // --- Schedule CRUD ---

  const toggleShabbat = async () => {
    if (!childId || !user) return;

    const existing = scheduleWindows.find((s) => s.schedule_type === "shabbat");

    if (existing) {
      const { error } = await supabase
        .from("schedule_windows")
        .update({ is_active: !existing.is_active })
        .eq("id", existing.id);

      if (error) {
        toast.error("שגיאה בעדכון מצב שבת");
        return;
      }
    } else {
      const { error } = await supabase.from("schedule_windows").insert({
        child_id: childId,
        name: "שבת",
        schedule_type: "shabbat",
        is_active: true,
        days_of_week: null,
        start_time: null,
        end_time: null,
        mode: "default",
      });

      if (error) {
        toast.error("שגיאה ביצירת חוק שבת");
        return;
      }
    }

    await sendRefreshToAllDevices();
    toast.success(existing?.is_active ? "מצב שבת כובה" : "מצב שבת הופעל");
    fetchData();
  };

  /** Update shabbat mode (default/manual) and optional manual times */
  const updateShabbatMode = async (
    scheduleId: string,
    mode: "default" | "manual",
    manualStartTime?: string,
    manualEndTime?: string
  ) => {
    if (!childId) return;

    const updateData: Record<string, any> = { mode };
    if (mode === "manual") {
      updateData.manual_start_time = manualStartTime || null;
      updateData.manual_end_time = manualEndTime || null;
    } else {
      updateData.manual_start_time = null;
      updateData.manual_end_time = null;
    }

    const { error } = await supabase
      .from("schedule_windows")
      .update(updateData)
      .eq("id", scheduleId);

    if (error) {
      toast.error("שגיאה בעדכון מצב שבת");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success(mode === "manual" ? "זמני שבת ידניים נשמרו" : "חזרה לזמני שבת אוטומטיים");
    fetchData();
  };

  const createSchedule = async (params: {
    schedule_type: string;
    name: string;
    days_of_week: number[];
    start_time: string;
    end_time: string;
  }) => {
    if (!childId || !user) return;

    const { error } = await supabase.from("schedule_windows").insert({
      child_id: childId,
      name: params.name,
      schedule_type: params.schedule_type,
      days_of_week: params.days_of_week,
      start_time: params.start_time,
      end_time: params.end_time,
      is_active: true,
    });

    if (error) {
      toast.error("שגיאה ביצירת לוח זמנים");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success("לוח זמנים נוצר בהצלחה");
    fetchData();
  };

  const updateSchedule = async (
    scheduleId: string,
    params: {
      name?: string;
      days_of_week?: number[];
      start_time?: string;
      end_time?: string;
      is_active?: boolean;
    }
  ) => {
    if (!childId) return;

    const { error } = await supabase
      .from("schedule_windows")
      .update(params)
      .eq("id", scheduleId);

    if (error) {
      toast.error("שגיאה בעדכון לוח זמנים");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success("לוח זמנים עודכן בהצלחה");
    fetchData();
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!childId) return;

    const { error } = await supabase
      .from("schedule_windows")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      toast.error("שגיאה במחיקת לוח זמנים");
      return;
    }

    await sendRefreshToAllDevices();
    toast.success("לוח זמנים נמחק");
    fetchData();
  };

  return {
    appPolicies,
    blockedAttempts,
    deviceHealth,
    recentCommands,
    installedApps,
    scheduleWindows,
    nextShabbat,
    todayBonusMinutes,
    loading,
    toggleAppBlock,
    approveApp,
    blockApp,
    updateDailyLimit,
    grantBonusTime,
    toggleShabbat,
    updateShabbatMode,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    refetch: fetchData,
  };
}
