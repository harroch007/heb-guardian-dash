import { useState, useEffect, useCallback } from "react";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import type { Json } from "@/integrations/supabase/v2-types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getIsraelDate } from "@/lib/utils";
import { listRecentParentalControlCommands } from "@/lib/parental-controls/commandService";
import {
  createProtectionSchedule,
  deleteProtectionSchedule,
  grantParentBonusTime,
  saveAppPolicy,
  saveDailyScreenTimeLimit,
  saveShabbatMode,
  toggleShabbatSchedule,
  updateProtectionSchedule,
} from "@/lib/parental-controls/settingsService";

export interface AppPolicy {
  id: string;
  child_id: string;
  package_name: string;
  app_name: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  blocked_by: string | null;
  policy_status: "approved" | "blocked";
  always_allowed: boolean;
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

const capabilitySatisfied = (
  capabilities: Json,
  key: string,
): boolean | undefined => {
  if (
    !capabilities ||
    Array.isArray(capabilities) ||
    typeof capabilities !== "object"
  ) {
    return undefined;
  }
  const capability = capabilities[key];
  if (
    !capability ||
    Array.isArray(capability) ||
    typeof capability !== "object"
  ) {
    return undefined;
  }
  return capability.state === "satisfied";
};

const scheduleDisplayType = (name: string, scheduleType: string) => {
  if (scheduleType === "shabbat") return "shabbat";
  const normalized = name.toLocaleLowerCase("he");
  if (
    normalized.includes("שינה") ||
    normalized.includes("לילה") ||
    normalized.includes("bed")
  ) {
    return "bedtime";
  }
  if (
    normalized.includes("בית ספר") ||
    normalized.includes("לימוד") ||
    normalized.includes("school")
  ) {
    return "school";
  }
  return scheduleType;
};

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

  /*
   * Legacy V1 donor read model retained until the explicit cleanup phase.
   *
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
      const hb = healthRes.data as unknown as DeviceHealthRpcResult;
      const device = hb.device;
      const permissions = hb.permissions;
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
      const total = bonusRes.data.reduce(
        (sum, row) => sum + (row.bonus_minutes || 0),
        0,
      );
      setTodayBonusMinutes(total);
    } else {
      setTodayBonusMinutes(0);
    }

    // Commands scoped to child's devices only (last 5 minutes to avoid stale UI)
    const childDeviceIds = devicesRes.data?.map((d) => d.device_id) || [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    if (childDeviceIds.length > 0) {
      try {
        const commandsData = await listRecentParentalControlCommands({
          deviceIds: childDeviceIds,
          commandType: "REFRESH_SETTINGS",
          statuses: ["PENDING", "ACKNOWLEDGED", "FAILED", "TIMED_OUT"],
          since: fiveMinutesAgo,
          limit: 10,
        });
        setRecentCommands(commandsData as DeviceCommand[]);
      } catch {
        setRecentCommands([]);
      }
    } else {
      setRecentCommands([]);
    }

    setLoading(false);
  }, [childId, user]);
  */

  const fetchData = useCallback(async () => {
    if (!childId || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const todayIsrael = getIsraelDate();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [devicesResult, policiesResult, schedulesResult, bonusResult] =
        await Promise.all([
          v2Supabase
            .from("v2_protected_devices")
            .select("*")
            .eq("child_id", childId)
            .neq("status", "revoked")
            .order("last_seen_at", { ascending: false }),
          v2Supabase
            .from("v2_parental_app_policies")
            .select("*")
            .eq("child_id", childId)
            .order("app_name"),
          v2Supabase
            .from("v2_parental_schedules")
            .select("*")
            .eq("child_id", childId)
            .order("created_at"),
          v2Supabase
            .from("v2_parental_bonus_grants")
            .select("bonus_minutes")
            .eq("child_id", childId)
            .eq("grant_date", todayIsrael),
        ]);

      const baseError = [
        devicesResult.error,
        policiesResult.error,
        schedulesResult.error,
        bonusResult.error,
      ].find(Boolean);
      if (baseError) throw baseError;

      const policies: AppPolicy[] = (policiesResult.data || []).map(
        (policy) => ({
          id: policy.id,
          child_id: policy.child_id,
          package_name: policy.package_name,
          app_name: policy.app_name,
          is_blocked: policy.policy_status === "blocked",
          blocked_at:
            policy.policy_status === "blocked" ? policy.updated_at : null,
          blocked_by:
            policy.policy_status === "blocked" ? policy.updated_by : null,
          policy_status:
            policy.policy_status === "blocked" ? "blocked" : "approved",
          always_allowed: policy.always_allowed,
        }),
      );
      setAppPolicies(policies);

      setScheduleWindows(
        (schedulesResult.data || []).map((schedule) => ({
          id: schedule.id,
          child_id: schedule.child_id,
          name: schedule.name,
          schedule_type: scheduleDisplayType(
            schedule.name,
            schedule.schedule_type,
          ),
          days_of_week: schedule.days_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          is_active: schedule.is_active,
          created_at: schedule.created_at,
          updated_at: schedule.updated_at,
          mode: schedule.mode,
          manual_start_time:
            schedule.mode === "manual" ? schedule.start_time : null,
          manual_end_time:
            schedule.mode === "manual" ? schedule.end_time : null,
        })),
      );

      setTodayBonusMinutes(
        (bonusResult.data || []).reduce(
          (total, grant) => total + grant.bonus_minutes,
          0,
        ),
      );
      setNextShabbat(null);

      const devices = devicesResult.data || [];
      const deviceIds = devices.map((device) => device.id);
      const primaryDevice = devices[0] ?? null;

      if (deviceIds.length === 0) {
        setBlockedAttempts([]);
        setInstalledApps([]);
        setDeviceHealth(null);
        setRecentCommands([]);
        return;
      }

      const [attemptsResult, installedResult, healthResult] =
        await Promise.all([
          v2Supabase
            .from("v2_parental_blocked_attempts")
            .select("package_name, attempted_at")
            .in("device_id", deviceIds)
            .gte("attempted_at", todayStart.toISOString()),
          v2Supabase
            .from("v2_parental_installed_apps")
            .select("*")
            .in("device_id", deviceIds)
            .eq("is_installed", true)
            .eq("is_system", false)
            .order("app_name"),
          v2Supabase
            .from("v2_device_health_events")
            .select("*")
            .in("device_id", deviceIds)
            .eq("affects_current_state", true)
            .order("observed_at", { ascending: false })
            .limit(1),
        ]);

      const deviceError = [
        attemptsResult.error,
        installedResult.error,
        healthResult.error,
      ].find(Boolean);
      if (deviceError) throw deviceError;

      const attemptsMap = new Map<
        string,
        { count: number; last: string }
      >();
      for (const attempt of attemptsResult.data || []) {
        const existing = attemptsMap.get(attempt.package_name);
        if (existing) {
          existing.count += 1;
          if (attempt.attempted_at > existing.last) {
            existing.last = attempt.attempted_at;
          }
        } else {
          attemptsMap.set(attempt.package_name, {
            count: 1,
            last: attempt.attempted_at,
          });
        }
      }
      setBlockedAttempts(
        [...attemptsMap.entries()].map(([packageName, summary]) => ({
          package_name: packageName,
          attempts_today: summary.count,
          last_attempt: summary.last,
        })),
      );

      setInstalledApps(
        (installedResult.data || []).map((app) => ({
          id: `${app.device_id}:${app.package_name}`,
          child_id: childId,
          package_name: app.package_name,
          app_name: app.app_name,
          is_system: app.is_system,
          category: null,
          first_seen_at: app.first_seen_at,
          last_seen_at: app.last_seen_at,
        })),
      );

      const health = healthResult.data?.[0] ?? null;
      if (health) {
        const permissions: Record<string, boolean> = {
          accessibilityEnabled: health.accessibility_enabled,
          notificationListenerEnabled:
            health.notification_listener_enabled,
          batteryOptimizationIgnored:
            health.battery_optimization_exempt,
        };
        const capabilities: Array<[string, string]> = [
          ["usageStatsGranted", "usage_access"],
          ["locationPermissionGranted", "background_location"],
          ["locationServicesEnabled", "location_services"],
        ];
        for (const [permissionKey, capabilityKey] of capabilities) {
          const satisfied = capabilitySatisfied(
            health.capabilities,
            capabilityKey,
          );
          if (satisfied !== undefined) {
            permissions[permissionKey] = satisfied;
          }
        }
        setDeviceHealth({
          permissions,
          deviceVersion:
            health.app_version || primaryDevice?.app_version || null,
          deviceModel: primaryDevice
            ? [primaryDevice.manufacturer, primaryDevice.model]
                .filter(Boolean)
                .join(" ") || null
            : null,
          reportedAt: health.observed_at,
        });
      } else {
        setDeviceHealth(null);
      }

      const fiveMinutesAgo = new Date(
        Date.now() - 5 * 60 * 1000,
      ).toISOString();
      try {
        const commands = await listRecentParentalControlCommands({
          deviceIds,
          commandType: "REFRESH_SETTINGS",
          statuses: ["PENDING", "CLAIMED", "FAILED"],
          since: fiveMinutesAgo,
          limit: 10,
        });
        setRecentCommands(commands as DeviceCommand[]);
      } catch {
        setRecentCommands([]);
      }
    } catch (error) {
      console.error("[child-controls] Failed to load V2 controls", error);
    } finally {
      setLoading(false);
    }
  }, [childId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAppBlock = async (packageName: string, appName: string | null, currentlyBlocked: boolean) => {
    if (!childId || !user) return;

    const newBlocked = !currentlyBlocked;

    try {
      await saveAppPolicy({
        childId,
        parentId: user.id,
        packageName,
        appName,
        blocked: newBlocked,
      });
    } catch {
      toast.error("שגיאה בעדכון מדיניות האפליקציה");
      return;
    }

    toast.success(newBlocked ? "האפליקציה נחסמה" : "האפליקציה שוחררה");
    fetchData();
  };

  /** Approve a pending app — creates policy row with approved status */
  const approveApp = async (packageName: string, appName: string | null) => {
    if (!childId || !user) return;

    try {
      await saveAppPolicy({
        childId,
        parentId: user.id,
        packageName,
        appName,
        blocked: false,
      });
    } catch {
      toast.error("שגיאה באישור האפליקציה");
      return;
    }

    toast.success("האפליקציה אושרה");
    fetchData();
  };

  /** Block a pending app — creates policy row with blocked status */
  const blockApp = async (packageName: string, appName: string | null) => {
    if (!childId || !user) return;

    try {
      await saveAppPolicy({
        childId,
        parentId: user.id,
        packageName,
        appName,
        blocked: true,
      });
    } catch {
      toast.error("שגיאה בחסימת האפליקציה");
      return;
    }

    toast.success("האפליקציה נחסמה");
    fetchData();
  };

  const updateDailyLimit = async (minutes: number | null) => {
    if (!childId || !user) return;

    try {
      await saveDailyScreenTimeLimit({
        childId,
        parentId: user.id,
        minutes,
      });
    } catch {
      toast.error("שגיאה בעדכון מגבלת זמן המסך");
      return;
    }

    toast.success(minutes ? "מגבלת זמן מסך עודכנה" : "מגבלת זמן מסך הוסרה");
  };

  /** Grant bonus time for today (Israel TZ) */
  const grantBonusTime = async (minutes: number) => {
    if (!childId || !user) return;

    try {
      await grantParentBonusTime({
        childId,
        parentId: user.id,
        grantDate: getIsraelDate(),
        minutes,
      });
    } catch {
      toast.error("שגיאה בהוספת זמן בונוס");
      return;
    }

    toast.success(`נוסף זמן בונוס של ${minutes} דקות להיום`);
    fetchData();
  };

  // --- Schedule CRUD ---

  const toggleShabbat = async () => {
    if (!childId || !user) return;

    let nextActive: boolean;
    try {
      nextActive = await toggleShabbatSchedule(childId);
    } catch {
      toast.error("שגיאה בעדכון מצב שבת");
      return;
    }

    toast.success(nextActive ? "מצב שבת הופעל" : "מצב שבת כובה");
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

    try {
      await saveShabbatMode({
        childId,
        scheduleId,
        mode,
        manualStartTime,
        manualEndTime,
      });
    } catch {
      toast.error("שגיאה בעדכון מצב שבת");
      return;
    }

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

    try {
      await createProtectionSchedule(childId, params);
    } catch {
      toast.error("שגיאה ביצירת לוח זמנים");
      return;
    }

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

    try {
      await updateProtectionSchedule({
        childId,
        scheduleId,
        patch: params,
      });
    } catch {
      toast.error("שגיאה בעדכון לוח זמנים");
      return;
    }

    toast.success("לוח זמנים עודכן בהצלחה");
    fetchData();
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!childId) return;

    try {
      await deleteProtectionSchedule({ childId, scheduleId });
    } catch {
      toast.error("שגיאה במחיקת לוח זמנים");
      return;
    }

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
