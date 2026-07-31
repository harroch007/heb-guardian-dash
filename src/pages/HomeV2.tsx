import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getIsraelDate } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { HomeGreeting } from "@/components/home-v2/HomeGreeting";
import { FamilyStatusHero } from "@/components/home-v2/FamilyStatusHero";
import { ChildCardV2 } from "@/components/home-v2/ChildCardV2";
import { AttentionSection } from "@/components/home-v2/AttentionSection";
import { FamilyLocationsMap } from "@/components/home-v2/FamilyLocationsMap";
import { DailyControlSummary } from "@/components/home-v2/DailyControlSummary";
import { HomePendingApps } from "@/components/home-v2/HomePendingApps";
import { HomePendingGeofenceAlerts } from "@/components/home-v2/HomePendingGeofenceAlerts";
import { SmartProtectionSummary } from "@/components/home-v2/SmartProtectionSummary";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { Accordion } from "@/components/ui/accordion";
import {
  V2_GUARDIAN_ALERTS_ENABLED,
  WHATSAPP_MONITORING_ENABLED,
} from "@/config/featureFlags";
import { getV2GuardianHome } from "@/lib/v2/guardianHomeService";

export interface ActiveRestriction {
  type: "schedule" | "shabbat";
  name: string;
}

export interface ChildWithData {
  id: string;
  name: string;
  gender: string;
  subscription_tier: string | null;
  device?: {
    device_id: string;
    battery_level: number | null;
    last_seen: string | null;
    address: string | null;
    lat: number | null;
    lon: number | null;
  } | null;
  snapshot?: {
    total_usage_minutes: number | null;
    messages_scanned: number | null;
    alerts_sent: number | null;
  } | null;
  dailyLimit: number | null;
  todayBonusMinutes: number;
  unacknowledgedAlerts: number;
  scheduleWindows: {
    id: string;
    schedule_type: string;
    name: string;
    days_of_week: number[] | null;
    start_time: string | null;
    end_time: string | null;
    is_active: boolean;
  }[];
  permissionIssues: string[];
  activeRestriction: ActiveRestriction | null;
}

const HomeV2 = () => {
  const { familyId } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [childrenData, setChildrenData] = useState<ChildWithData[]>([]);

  /*
   * Legacy V1 donor implementation retained verbatim until the explicit
   * destructive-cleanup phase. It is intentionally not compiled or executed.
   *
  const fetchAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const todayIsrael = getIsraelDate();

      // 1. Fetch children — explicitly scoped to this family (own + accepted co-parent owners)
      // so admin-level RLS bypass doesn't leak other families' children into the parent UI.
      const allowedParentIds = await getFamilyParentIds(user.id);
      const { data: children } = await supabase
        .from("children")
        .select("id, name, gender, subscription_tier")
        .in("parent_id", allowedParentIds)
        .order("created_at", { ascending: true });

      if (!children || children.length === 0) {
        setChildrenData([]);
        setLoading(false);
        return;
      }

      const childIds = children.map((c) => c.id);

      // 2. Parallel fetches for all children
      const [
        devicesRes,
        snapshotsRes,
        settingsRes,
        bonusRes,
        alertsRes,
        alertThresholdRes,
        schedulesRes,
        shabbatRes,
      ] = await Promise.all([
        supabase
          .from("devices")
          .select("child_id, device_id, battery_level, last_seen, address, latitude, longitude")
          .in("child_id", childIds),
        supabase
          .from("parent_home_snapshot")
          .select("child_id, total_usage_minutes, messages_scanned, alerts_sent")
          .in("child_id", childIds),
        supabase
          .from("settings")
          .select("child_id, daily_screen_time_limit_minutes")
          .in("child_id", childIds),
        supabase
          .from("bonus_time_grants")
          .select("child_id, bonus_minutes")
          .in("child_id", childIds)
          .eq("grant_date", todayIsrael),
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
          .from("schedule_windows")
          .select("id, child_id, schedule_type, name, days_of_week, start_time, end_time, is_active")
          .in("child_id", childIds),
        supabase
          .from("issur_melacha_windows")
          .select("child_id, event_name, start_epoch_ms, end_epoch_ms, is_active")
          .in("child_id", childIds)
          .eq("is_active", true),
      ]);

      // 3. Fetch device health per child (sequential, RPC)
      const WHATSAPP_PERMISSION_KEYS = ["accessibilityEnabled", "notificationListenerEnabled"];
      const healthMap: Record<string, string[]> = {};
      for (const child of children) {
        try {
          const { data: healthData } = await supabase.rpc("get_child_device_health", {
            p_child_id: child.id,
          });
          if (healthData) {
            const perms = (
              healthData as unknown as {
                permissions?: Record<string, boolean> | null;
              }
            ).permissions;
            if (perms) {
              const issues = Object.entries(perms)
                .filter(
                  ([k, v]) =>
                    v === false &&
                    (WHATSAPP_MONITORING_ENABLED || !WHATSAPP_PERMISSION_KEYS.includes(k))
                )
                .map(([k]) => k);
              if (issues.length > 0) healthMap[child.id] = issues;
            }
          }
        } catch {
          // ignore per-child health errors
        }
      }

      // Build threshold map
      const thresholds: Record<string, number> = {};
      alertThresholdRes.data?.forEach((s) => {
        if (s.child_id) thresholds[s.child_id] = s.alert_threshold ?? 65;
      });
      const now = new Date();
      const nowMs = now.getTime();
      // schedule_windows uses 1=Sun..7=Sat
      const dayOfWeek1 = now.getDay() + 1;
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      // Helper: find active restriction for a child
      const getActiveRestriction = (childId: string): ActiveRestriction | null => {
        // Check Shabbat/holiday windows first
        const shabbatWindows = (shabbatRes.data || []).filter((w) => w.child_id === childId);
        for (const w of shabbatWindows) {
          if (nowMs >= w.start_epoch_ms && nowMs <= w.end_epoch_ms) {
            return { type: "shabbat", name: w.event_name || "שבתות וחגים" };
          }
        }
        // Check schedule windows
        const schedules = (schedulesRes.data || []).filter((s) => s.child_id === childId);
        for (const s of schedules) {
          if (!s.is_active) continue;
          if (s.schedule_type === "shabbat") continue;
          if (!s.days_of_week || !s.start_time || !s.end_time) continue;
          if (!s.days_of_week.includes(dayOfWeek1)) continue;
          const crossesMidnight = s.start_time > s.end_time;
          const inWindow = crossesMidnight
            ? (currentTime >= s.start_time || currentTime <= s.end_time)
            : (currentTime >= s.start_time && currentTime <= s.end_time);
          if (inWindow) {
            return { type: "schedule", name: s.name };
          }
        }
        return null;
      };

      // 4. Build enriched data
      const enriched: ChildWithData[] = children.map((child) => {
        const device = devicesRes.data?.find((d) => d.child_id === child.id) || null;
        const snap = snapshotsRes.data?.find((s) => s.child_id === child.id) || null;
        const setting = settingsRes.data?.find((s) => s.child_id === child.id);
        const todayBonus = (bonusRes.data || [])
          .filter((b) => b.child_id === child.id)
          .reduce((sum, b) => sum + (b.bonus_minutes || 0), 0);
        const threshold = thresholds[child.id] ?? 65;
        const alertCount = (alertsRes.data || []).filter(
          (a) =>
            a.child_id === child.id &&
            (a.ai_risk_score ?? 0) >= threshold &&
            (!a.remind_at || new Date(a.remind_at) < now)
        ).length;
        const schedules = (schedulesRes.data || [])
          .filter((s) => s.child_id === child.id)
          .map((s) => ({
            id: s.id,
            schedule_type: s.schedule_type,
            name: s.name,
            days_of_week: s.days_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            is_active: s.is_active,
          }));

        return {
          id: child.id,
          name: child.name,
          gender: child.gender,
          subscription_tier: child.subscription_tier,
          device: device
            ? {
                device_id: device.device_id,
                battery_level: device.battery_level,
                last_seen: device.last_seen,
                address: device.address || null,
                lat: device.latitude,
                lon: device.longitude,
              }
            : null,
          snapshot: snap
            ? {
                total_usage_minutes: snap.total_usage_minutes,
                messages_scanned: snap.messages_scanned,
                alerts_sent: snap.alerts_sent,
              }
            : null,
          dailyLimit: setting?.daily_screen_time_limit_minutes ?? null,
          todayBonusMinutes: todayBonus,
          unacknowledgedAlerts: alertCount,
          scheduleWindows: schedules,
          permissionIssues: healthMap[child.id] || [],
          activeRestriction: getActiveRestriction(child.id),
        };
      });

      setChildrenData(enriched);
    } catch (err) {
      console.error("[HomeV2] Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  */

  const fetchAllData = useCallback(async () => {
    if (!familyId) {
      setChildrenData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const todayIsrael = getIsraelDate();
      const children = await getV2GuardianHome(familyId, todayIsrael);
      const now = new Date();
      const dayOfWeek = now.getDay() + 1;
      const currentTime = [
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      ]
        .map((value) => value.toString().padStart(2, "0"))
        .join(":");

      const enriched: ChildWithData[] = children.map((child) => {
        const activeSchedule = child.schedules.find((schedule) => {
          if (!schedule.is_active || !schedule.start_time || !schedule.end_time) {
            return false;
          }
          if (
            schedule.days_of_week &&
            !schedule.days_of_week.includes(dayOfWeek)
          ) {
            return false;
          }
          const crossesMidnight = schedule.start_time > schedule.end_time;
          return crossesMidnight
            ? currentTime >= schedule.start_time ||
                currentTime <= schedule.end_time
            : currentTime >= schedule.start_time &&
                currentTime <= schedule.end_time;
        });

        const degradedReasons =
          child.device?.degradedReasons.length
            ? child.device.degradedReasons
            : child.device?.productReady === false
              ? ["product_not_ready"]
              : [];

        return {
          id: child.id,
          name: child.displayName,
          gender: child.gender,
          subscription_tier: null,
          device: child.device
            ? {
                device_id: child.device.id,
                battery_level: child.device.batteryLevel,
                last_seen: child.device.lastSeenAt,
                address: child.device.address,
                lat: child.device.latitude,
                lon: child.device.longitude,
              }
            : null,
          snapshot: {
            total_usage_minutes: child.totalUsageMinutes,
            messages_scanned: null,
            alerts_sent: child.confirmedIncidentCount,
          },
          dailyLimit: child.dailyLimitMinutes,
          todayBonusMinutes: child.todayBonusMinutes,
          unacknowledgedAlerts: child.confirmedIncidentCount,
          scheduleWindows: child.schedules.map((schedule) => ({
            id: schedule.id,
            schedule_type: schedule.schedule_type,
            name: schedule.name,
            days_of_week: schedule.days_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            is_active: schedule.is_active,
          })),
          permissionIssues: degradedReasons,
          activeRestriction: activeSchedule
            ? {
                type:
                  activeSchedule.schedule_type === "shabbat"
                    ? "shabbat"
                    : "schedule",
                name: activeSchedule.name,
              }
            : null,
        };
      });

      setChildrenData(enriched);
    } catch (error) {
      console.error("[HomeV2] Error fetching V2 guardian home:", error);
      setChildrenData([]);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  if (loading) {
    return (
      <div className="v2-dark min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const connectedCount = childrenData.filter((c) => {
    if (!c.device?.last_seen) return false;
    const diff = Date.now() - new Date(c.device.last_seen).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length;

  const totalAlerts = childrenData.reduce((s, c) => s + c.unacknowledgedAlerts, 0);
  const totalPermIssues = childrenData.filter((c) => c.permissionIssues.length > 0).length;
  const disconnectedCount = childrenData.filter((c) => {
    if (!c.device?.last_seen) return true;
    return Date.now() - new Date(c.device.last_seen).getTime() > 24 * 60 * 60 * 1000;
  }).length;

  // When WhatsApp monitoring is disabled, exclude alerts from "open issues"
  const openIssues =
    (V2_GUARDIAN_ALERTS_ENABLED ? totalAlerts : 0) +
    totalPermIssues +
    disconnectedCount;

  // When WhatsApp monitoring is disabled, treat all users as premium for UI purposes
  // (hides upgrade CTAs in FamilyStatusHero)
  const hasPremium = WHATSAPP_MONITORING_ENABLED
    ? childrenData.some(
        (c) => c.subscription_tier === "premium" || c.subscription_tier === "pro"
      )
    : true;

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <TopNavigationV2 />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <HomeGreeting />

        <FamilyStatusHero
          childrenCount={childrenData.length}
          connectedCount={connectedCount}
          openIssues={openIssues}
          permissionIssueCount={totalPermIssues}
          hasPremium={hasPremium}
        />

        {childrenData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">אין ילדים רשומים עדיין</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {childrenData.map((child) => (
              <ChildCardV2 key={child.id} child={child} onRefresh={fetchAllData} />
            ))}
          </Accordion>
        )}

        <HomePendingGeofenceAlerts childrenData={childrenData} />

        <HomePendingApps childrenData={childrenData} />

        <AttentionSection childrenData={childrenData} />

        {childrenData.length > 0 && <FamilyLocationsMap children={childrenData} />}

        {childrenData.length === 1 && (
          <DailyControlSummary childrenData={childrenData} />
        )}

        {/* Smart Protection: hidden when WhatsApp monitoring is disabled */}
        {V2_GUARDIAN_ALERTS_ENABLED && <SmartProtectionSummary childrenData={childrenData} />}
      </div>
      <BottomNavigationV2 />
    </div>
  );
};

export default HomeV2;
