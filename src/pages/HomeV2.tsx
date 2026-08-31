import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { AddChildModal } from "@/components/AddChildModal";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import { AttentionSection } from "@/components/home-v2/AttentionSection";
import { ChildCardV2 } from "@/components/home-v2/ChildCardV2";
import { DailyControlSummary } from "@/components/home-v2/DailyControlSummary";
import { FamilyLocationsMap } from "@/components/home-v2/FamilyLocationsMap";
import { FamilyStatusHero } from "@/components/home-v2/FamilyStatusHero";
import { HomeGreeting } from "@/components/home-v2/HomeGreeting";
import { HomePendingApps } from "@/components/home-v2/HomePendingApps";
import { HomePendingGeofenceAlerts } from "@/components/home-v2/HomePendingGeofenceAlerts";
import { SmartProtectionSummary } from "@/components/home-v2/SmartProtectionSummary";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { getIsraelDate } from "@/lib/utils";
import { getV2GuardianHome } from "@/lib/v2/guardianHomeService";
import {
  hasCurrentDeviceReport,
  type GuardianMonitoringState,
} from "@/lib/v2/guardianMonitoringService";

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
    monitoring_state: GuardianMonitoringState;
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

const activeScheduleNow = (
  schedules: Awaited<ReturnType<typeof getV2GuardianHome>>[number]["schedules"],
): ActiveRestriction | null => {
  const now = new Date();
  const dayOfWeek = now.getDay() + 1;
  const currentTime = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
  const activeSchedule = schedules.find((schedule) => {
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
      ? currentTime >= schedule.start_time || currentTime <= schedule.end_time
      : currentTime >= schedule.start_time && currentTime <= schedule.end_time;
  });

  return activeSchedule
    ? {
        type:
          activeSchedule.schedule_type === "shabbat"
            ? "shabbat"
            : "schedule",
        name: activeSchedule.name,
      }
    : null;
};

const HomeV2 = () => {
  const { familyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [childrenData, setChildrenData] = useState<ChildWithData[]>([]);

  const fetchAllData = useCallback(async (silent = false) => {
    if (!familyId) {
      setChildrenData([]);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setLoadError(false);
    try {
      const children = await getV2GuardianHome(familyId, getIsraelDate());
      setChildrenData(
        children.map((child) => {
          const permissionIssues = child.device?.degradedReasons.length
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
                  monitoring_state: child.device.monitoringState,
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
            permissionIssues,
            activeRestriction: activeScheduleNow(child.schedules),
          };
        }),
      );
    } catch (error) {
      console.error("[HomeV2] Error fetching V2 guardian home:", error);
      if (!silent) setChildrenData([]);
      setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    void fetchAllData();

    const refresh = () => void fetchAllData(true);
    const intervalId = window.setInterval(refresh, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchAllData]);

  if (loading) {
    return (
      <div className="v2-dark min-h-screen" dir="rtl">
        <TopNavigationV2 />
        <div
          className="flex min-h-[70vh] items-center justify-center"
          role="status"
          aria-label="טוען את מרכז ההגנה"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const connectedCount = childrenData.filter(
    (child) =>
      child.device && hasCurrentDeviceReport(child.device.monitoring_state),
  ).length;
  const totalAlerts = childrenData.reduce(
    (total, child) => total + child.unacknowledgedAlerts,
    0,
  );
  const childrenRequiringAttention = childrenData.filter(
    (child) =>
      child.permissionIssues.length > 0 ||
      child.device?.monitoring_state !== "healthy",
  ).length;
  const openIssues = totalAlerts + childrenRequiringAttention;

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <TopNavigationV2 />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <HomeGreeting />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">
              הגנה חכמה ובקרת הורים
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              כל מצב המשפחה, בקרות המכשיר והתראות הבטיחות במקום אחד.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-11 shrink-0"
            onClick={() => setAddChildOpen(true)}
          >
            <Plus className="ml-1 h-4 w-4" />
            הוספת ילד
          </Button>
        </div>

        {loadError && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  לא הצלחנו לעדכן את מרכז ההגנה
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  אפשר לנסות שוב. לא בוצע שינוי בהגדרות.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
                onClick={() => void fetchAllData()}
              >
                <RefreshCw className="ml-1 h-4 w-4" />
                רענון
              </Button>
            </CardContent>
          </Card>
        )}

        <FamilyStatusHero
          childrenCount={childrenData.length}
          connectedCount={connectedCount}
          openIssues={openIssues}
        />

        {childrenData.length === 0 ? (
          <Card className="border-dashed border-border bg-card">
            <CardContent className="py-12 text-center">
              <Smartphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <h2 className="font-semibold text-foreground">
                עדיין אין מכשיר מנוטר
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                הוסיפו ילד וחברו את מכשיר ה־Android כדי להפעיל את כל שכבות ההגנה.
              </p>
              <Button
                type="button"
                className="mt-5 h-11"
                onClick={() => setAddChildOpen(true)}
              >
                <Plus className="ml-2 h-4 w-4" />
                הוספת ילד ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {childrenData.map((child) => (
              <ChildCardV2
                key={child.id}
                child={child}
                onRefresh={fetchAllData}
              />
            ))}
          </Accordion>
        )}

        <HomePendingGeofenceAlerts childrenData={childrenData} />
        <HomePendingApps childrenData={childrenData} />
        <AttentionSection childrenData={childrenData} />
        {childrenData.length > 0 && (
          <FamilyLocationsMap children={childrenData} />
        )}
        {childrenData.length === 1 && (
          <DailyControlSummary childrenData={childrenData} />
        )}
        <SmartProtectionSummary childrenData={childrenData} />
      </main>
      <AddChildModal
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onChildAdded={() => void fetchAllData()}
      />
      <BottomNavigationV2 />
    </div>
  );
};

export default HomeV2;
