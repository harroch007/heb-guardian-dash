import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useChildControls } from "@/hooks/useChildControls";
import { useRingCommand } from "@/hooks/useRingCommand";
import type { RingPhase } from "@/hooks/useRingCommand";
import { getDeviceStatus, getStatusLabel, formatLastSeen } from "@/lib/deviceStatus";
import { DeviceHealthBanner } from "@/components/controls/DeviceHealthBanner";
import { cn, getIsraelDate } from "@/lib/utils";
import {
  enqueueParentalControlCommand,
  getParentalControlCommand,
} from "@/lib/parental-controls/commandService";
import {
  isTerminalCommandStatus,
  type ParentalControlCommandType,
} from "@/lib/parental-controls/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ReconnectChildV2Modal } from "@/components/ReconnectChildV2Modal";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import {
  ProblemBanner,
  AppsSection,
  ProtectionCenterOverview,
  ScreenTimeSection,
  SchedulesSection,
} from "@/components/child-dashboard";
import { LocationSectionV2 } from "@/components/child-dashboard/LocationSectionV2";
import { GeofenceSection } from "@/components/child-dashboard/GeofenceSection";
import { LostModeV2Section } from "@/components/child-dashboard/LostModeV2Section";
import {
  ArrowRight,
  Loader2,
  Battery,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  Bell,
  Smartphone,
  MessageCircle,
} from "lucide-react";
import { V2_GUARDIAN_ALERTS_ENABLED } from "@/config/featureFlags";
import { gt } from "@/lib/genderText";

// ---------- Interfaces ----------
interface Child {
  id: string;
  name: string;
  date_of_birth: string;
  gender: string;
  subscription_tier: string | null;
  pairing_code: string | null;
}

interface Device {
  device_id: string;
  child_id: string;
  battery_level: number | null;
  latitude: number | null;
  longitude: number | null;
  last_seen: string | null;
  address: string | null;
}

interface AppUsage {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

type CommandStatus = "idle" | "locating" | "success" | "failed";

const LOCATE_SUCCESS_MESSAGE = {
  title: "המיקום עודכן",
  desc: "המיקום התקבל מהמכשיר בהצלחה",
};
const LOCATE_FAILURE_MESSAGE = {
  title: "שגיאה באיתור",
  desc: "לא ניתן לקבל מיקום מהמכשיר",
};
const SYNC_SUCCESS_MESSAGE = {
  title: "המכשיר עודכן",
  desc: "התקבל עדכון מהמכשיר בהצלחה",
};
const SYNC_FAILURE_MESSAGE = {
  title: "המכשיר לא מגיב",
  desc: "לא ניתן לקבל עדכון מהמכשיר",
};

export default function ChildControlV2() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user, familyId } = useAuth();
  const { toast } = useToast();

  const [child, setChild] = useState<Child | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenTimeLimit, setScreenTimeLimit] = useState<number | null>(null);
  const [totalUsageFromDb, setTotalUsageFromDb] = useState(0);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState(0);
  const [todayAlerts, setTodayAlerts] = useState(0);

  // Child management state
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  // Command statuses
  const [locateStatus, setLocateStatus] = useState<CommandStatus>("idle");
  const [locateCommandId, setLocateCommandId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [syncStatus, setSyncStatus] = useState<CommandStatus>("idle");
  const [syncCommandId, setSyncCommandId] = useState<string | null>(null);
  const syncPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background refresh indicator (subtle "updating..." state)
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Ring uses dedicated hook
  const { phase: ringPhase, sendRing, retry: retryRing } = useRingCommand(device?.device_id ?? null);

  const [showMap, setShowMap] = useState(false);

  const {
    appPolicies,
    blockedAttempts,
    deviceHealth,
    installedApps,
    scheduleWindows,
    todayBonusMinutes,
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
  } = useChildControls(childId);

  const status = getDeviceStatus(device !== null, device?.last_seen);

  // ---------- Active schedule helper (1-7 mapping) ----------
  const getActiveScheduleName = useCallback((): string | null => {
    if (!scheduleWindows || scheduleWindows.length === 0) return null;
    const now = new Date();
    const dayOfWeek = now.getDay() + 1; // 1=Sun ... 7=Sat
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    for (const sw of scheduleWindows) {
      if (!sw.is_active) continue;
      if (sw.schedule_type === "shabbat") continue;
      if (!sw.days_of_week?.includes(dayOfWeek)) continue;
      if (sw.start_time && sw.end_time) {
        if (sw.start_time <= sw.end_time) {
          if (currentTime >= sw.start_time && currentTime <= sw.end_time) return sw.name;
        } else {
          if (currentTime >= sw.start_time || currentTime <= sw.end_time) return sw.name;
        }
      }
    }
    return null;
  }, [scheduleWindows]);

  // ---------- Data fetching ----------
  /*
   * Legacy V1 donor read model retained until explicit cleanup.
   *
  const fetchData = useCallback(async (isPolling = false) => {
    if (!childId || !user) return;
    if (!isPolling) setLoading(true);
    else setIsRefreshing(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Explicitly scope by family ownership so admin RLS bypass cannot open another family's child.
    const allowedParentIds = await getFamilyParentIds(user.id);

    const [childRes, deviceRes, snapshotRes, settingsRes, alertsRes, alertsTodayRes] = await Promise.all([
      supabase.from("children").select("id, name, date_of_birth, gender, subscription_tier, pairing_code, parent_id").eq("id", childId).in("parent_id", allowedParentIds).maybeSingle(),
      supabase.from("devices").select("*").eq("child_id", childId).order("last_seen", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("parent_home_snapshot").select("top_apps, total_usage_minutes").eq("child_id", childId).maybeSingle(),
      supabase.from("settings").select("daily_screen_time_limit_minutes").eq("child_id", childId).maybeSingle(),
      supabase.from("alerts").select("id").eq("child_id", childId).is("acknowledged_at", null).eq("is_processed", true).eq("alert_type", "warning"),
      supabase.from("alerts").select("id").eq("child_id", childId).gte("created_at", todayStart.toISOString()),
    ]);

    if (!childRes.data) {
      if (!isPolling) navigate("/home-v2");
      else setIsRefreshing(false);
      return;
    }

    setChild(childRes.data as Child);
    setDevice(deviceRes.data as Device | null);

    if (snapshotRes.data?.top_apps && Array.isArray(snapshotRes.data.top_apps)) {
      setAppUsage(snapshotRes.data.top_apps as unknown as AppUsage[]);
    }
    setTotalUsageFromDb(snapshotRes.data?.total_usage_minutes ?? 0);
    setScreenTimeLimit(settingsRes.data?.daily_screen_time_limit_minutes ?? null);
    setUnacknowledgedAlerts(alertsRes.data?.length ?? 0);
    setTodayAlerts(alertsTodayRes.data?.length ?? 0);

    if (!isPolling) setLoading(false);
    else setIsRefreshing(false);
  }, [childId, user, navigate]);
  */

  const fetchData = useCallback(async (isPolling = false) => {
    if (!childId || !user || !familyId) return;
    if (!isPolling) setLoading(true);
    else setIsRefreshing(true);

    try {
      const today = getIsraelDate();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [childResult, devicesResult, settingsResult, incidentsResult] =
        await Promise.all([
          v2Supabase
            .from("v2_children")
            .select("*")
            .eq("id", childId)
            .eq("family_id", familyId)
            .eq("status", "active")
            .maybeSingle(),
          v2Supabase
            .from("v2_protected_devices")
            .select("*")
            .eq("child_id", childId)
            .neq("status", "revoked")
            .order("last_seen_at", { ascending: false })
            .limit(1),
          v2Supabase
            .from("v2_parental_settings")
            .select("daily_screen_time_limit_minutes")
            .eq("child_id", childId)
            .maybeSingle(),
          v2Supabase
            .from("v2_safety_incidents")
            .select("id, occurred_at")
            .eq("child_id", childId)
            .in("status", ["confirmed", "alerted"]),
        ]);

      const firstError = [
        childResult.error,
        devicesResult.error,
        settingsResult.error,
        incidentsResult.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      if (!childResult.data) {
        if (!isPolling) navigate("/home-v2");
        return;
      }

      const childRow = childResult.data;
      setChild({
        id: childRow.id,
        name: childRow.display_name,
        date_of_birth: childRow.birth_year
          ? `${childRow.birth_year}-01-01`
          : "",
        gender: childRow.gender,
        subscription_tier: null,
        pairing_code: null,
      });
      setScreenTimeLimit(
        settingsResult.data?.daily_screen_time_limit_minutes ?? null,
      );

      const incidents = incidentsResult.data || [];
      const nonNewIncidentIds = new Set<string>();
      if (incidents.length > 0) {
        const { data: guardianStates, error: guardianStatesError } =
          await v2Supabase
            .from("v2_guardian_incident_states")
            .select("incident_id")
            .in(
              "incident_id",
              incidents.map((incident) => incident.id),
            )
            .in("state", ["saved", "acknowledged"]);
        if (guardianStatesError) throw guardianStatesError;
        for (const state of guardianStates ?? []) {
          nonNewIncidentIds.add(state.incident_id);
        }
      }
      const newIncidents = incidents.filter(
        (incident) => !nonNewIncidentIds.has(incident.id),
      );
      setUnacknowledgedAlerts(newIncidents.length);
      setTodayAlerts(
        newIncidents.filter(
          (incident) =>
            new Date(incident.occurred_at) >= todayStart,
        ).length,
      );

      const deviceRow = devicesResult.data?.[0] ?? null;
      if (!deviceRow) {
        setDevice(null);
        setAppUsage([]);
        setTotalUsageFromDb(0);
        return;
      }

      const [stateResult, healthResult, usageResult] = await Promise.all([
        v2Supabase
          .from("v2_parental_device_state")
          .select("*")
          .eq("device_id", deviceRow.id)
          .maybeSingle(),
        v2Supabase
          .from("v2_device_health_events")
          .select("battery_level_percent")
          .eq("device_id", deviceRow.id)
          .eq("affects_current_state", true)
          .order("observed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        v2Supabase
          .from("v2_parental_app_usage_daily")
          .select("app_name, package_name, usage_minutes")
          .eq("device_id", deviceRow.id)
          .eq("usage_date", today)
          .order("usage_minutes", { ascending: false }),
      ]);

      const deviceError = [
        stateResult.error,
        healthResult.error,
        usageResult.error,
      ].find(Boolean);
      if (deviceError) throw deviceError;

      const state = stateResult.data;
      setDevice({
        device_id: deviceRow.id,
        child_id: childId,
        battery_level: healthResult.data?.battery_level_percent ?? null,
        latitude: state?.latitude ?? null,
        longitude: state?.longitude ?? null,
        last_seen: deviceRow.last_seen_at,
        address: state?.location_address ?? null,
      });
      setAppUsage(
        (usageResult.data || []).map((app) => ({
          app_name: app.app_name,
          package_name: app.package_name,
          usage_minutes: app.usage_minutes,
        })),
      );
      setTotalUsageFromDb(
        state?.usage_date === today
          ? state.total_screen_minutes ?? 0
          : 0,
      );
    } catch (error) {
      console.error("[ChildControlV2] Failed to load V2 data", error);
    } finally {
      if (!isPolling) setLoading(false);
      else setIsRefreshing(false);
    }
  }, [childId, user, familyId, navigate]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  // Polling every 30s (aligned with sync-triggers memory)
  useEffect(() => {
    if (!childId || !user) return;
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [childId, user, fetchData]);

  // Refresh immediately when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [fetchData]);

  // ---------- Real-time device subscription ----------
  // Subscribe per child_id (stable) instead of device_id, so we capture the
  // first device row inserted as well as updates. UPDATE-only filter for efficiency.
  useEffect(() => {
    if (!childId) return;
    const channel = v2Supabase
      .channel(`v2-child-control-${childId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "v2_protected_devices",
          filter: `child_id=eq.${childId}`,
        },
        () => void fetchData(true),
      )
      .subscribe();
    return () => {
      void v2Supabase.removeChannel(channel);
    };
  }, [childId, fetchData]);

  useEffect(() => {
    if (!device?.device_id) return;
    const channel = v2Supabase
      .channel(`v2-device-state-${device.device_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "v2_parental_device_state",
          filter: `device_id=eq.${device.device_id}`,
        },
        () => void fetchData(true),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "v2_device_health_events",
          filter: `device_id=eq.${device.device_id}`,
        },
        () => void fetchData(true),
      )
      .subscribe();
    return () => {
      void v2Supabase.removeChannel(channel);
    };
  }, [device?.device_id, fetchData]);

  // ---------- Command helpers ----------
  const useCommandPolling = (
    commandId: string | null,
    commandStatus: CommandStatus,
    setStatus: (s: CommandStatus) => void,
    setCommandId: (id: string | null) => void,
    ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
    onSuccess?: () => void,
    successMessage?: { title: string; desc: string },
    failMessage?: { title: string; desc: string },
  ) => {
    useEffect(() => {
      if (!commandId || commandStatus !== "locating") return;
      const startTime = Date.now();
      const TIMEOUT_MS = 2 * 60 * 1000;

      const poll = async () => {
        try {
          const command = await getParentalControlCommand(commandId);
          if (command?.status === "COMPLETED") {
            setStatus("success");
            setCommandId(null);
            onSuccess?.();
            if (successMessage) toast({ title: successMessage.title, description: successMessage.desc });
            setTimeout(() => setStatus("idle"), 5000);
            return;
          }
          if (command && isTerminalCommandStatus(command.status)) {
            setStatus("failed");
            setCommandId(null);
            if (failMessage) toast({ title: failMessage.title, description: failMessage.desc, variant: "destructive" });
            return;
          }
        } catch {
          // A transient read failure should not create a second command.
        }
        if (Date.now() - startTime > TIMEOUT_MS) {
          setStatus("failed");
          setCommandId(null);
          toast({ title: "המכשיר לא מגיב", description: "לא ניתן להתחבר למכשיר.", variant: "destructive" });
          return;
        }
        ref.current = setTimeout(poll, 5000);
      };
      poll();
      return () => { if (ref.current) clearTimeout(ref.current); };
    }, [
      commandId,
      commandStatus,
      failMessage,
      onSuccess,
      ref,
      setCommandId,
      setStatus,
      successMessage,
    ]);
  };

  const handleLocateCommandSuccess = useCallback(async () => {
    if (!device?.device_id) return;
    await fetchData(true);
    setShowMap(true);
  }, [device?.device_id, fetchData]);

  const handleSyncCommandSuccess = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Locate polling
  useCommandPolling(locateCommandId, locateStatus, setLocateStatus, setLocateCommandId, pollingRef,
    handleLocateCommandSuccess,
    LOCATE_SUCCESS_MESSAGE,
    LOCATE_FAILURE_MESSAGE,
  );

  // Sync polling
  useCommandPolling(syncCommandId, syncStatus, setSyncStatus, setSyncCommandId, syncPollingRef,
    handleSyncCommandSuccess,
    SYNC_SUCCESS_MESSAGE,
    SYNC_FAILURE_MESSAGE,
  );

  // Ring phase toast (only on terminal states)
  const prevRingPhase = useRef<RingPhase>("idle");
  useEffect(() => {
    if (ringPhase === prevRingPhase.current) return;
    prevRingPhase.current = ringPhase;
    if (ringPhase === "child_stopped") toast({ title: gt(child?.gender, "הילד עצר את הצלצול", "הילדה עצרה את הצלצול") });
    else if (ringPhase === "timeout" || ringPhase === "completed_legacy") toast({ title: "הצלצול הסתיים" });
    else if (ringPhase === "failed") toast({ title: "לא ניתן לצלצל", description: "המכשיר לא הצליח להשמיע צליל", variant: "destructive" });
  }, [ringPhase, toast, child?.gender]);

  const sendCommand = async (type: ParentalControlCommandType, setCmd: (id: string | null) => void, setStat: (s: CommandStatus) => void) => {
    if (!device?.device_id) return;
    setStat("locating");
    try {
      const command = await enqueueParentalControlCommand({
        deviceId: device.device_id,
        commandType: type,
      });
      setCmd(command.id);
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח פקודה למכשיר", variant: "destructive" });
      setStat("failed");
    }
  };

  const handleLocateNow = () => { setShowMap(false); sendCommand("LOCATE_NOW", setLocateCommandId, setLocateStatus); };
  const handleRingDevice = () => sendRing();
  const handleRequestSync = () => sendCommand("REPORT_HEARTBEAT", setSyncCommandId, setSyncStatus);

  const getLocateButtonContent = () => {
    switch (locateStatus) {
      case "locating": return (<><Loader2 className="w-4 h-4 animate-spin ml-2" />מאתר...</>);
      case "failed": return (<><AlertTriangle className="w-4 h-4 ml-2 text-destructive" />אתר עכשיו</>);
      default: return (<><LocateFixed className="w-4 h-4 ml-2" />אתר עכשיו</>);
    }
  };

  // ---------- Active restriction ----------
  const activeRestrictionName = getActiveScheduleName();

  // ---------- V2 safety monitoring ----------
  const isMonitoringActive =
    V2_GUARDIAN_ALERTS_ENABLED && device !== null && status === "connected";
  const activeSchedulesCount = scheduleWindows.filter((window) => window.is_active).length;
  const blockedAppsCount = appPolicies.filter((policy) => policy.is_blocked).length;
  const decidedAppPackages = new Set(appPolicies.map((policy) => policy.package_name));
  const pendingAppsCount = installedApps.filter(
    (app) => !decidedAppPackages.has(app.package_name),
  ).length;
  const hasLocation = device?.latitude != null && device?.longitude != null;

  if (loading) {
    return (
      <div className="v2-dark min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ===== 1. CHILD HEADER ===== */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home-v2")} className="shrink-0 h-9 w-9">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold truncate text-foreground">{child?.name}</h1>
              <Badge variant="secondary" className={cn("text-[11px] px-2 py-0.5 shrink-0",
                status === "connected" && "bg-success/15 text-success",
                status === "inactive" && "bg-warning/15 text-warning",
                status === "not_connected" && "bg-destructive/15 text-destructive",
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full ml-1",
                  status === "connected" && "bg-success",
                  status === "inactive" && "bg-warning",
                  status === "not_connected" && "bg-destructive",
                )} />
                {getStatusLabel(status)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {device?.battery_level != null && (
                <>
                  <Battery className={cn("w-3.5 h-3.5",
                    device.battery_level <= 20 ? "text-destructive" : device.battery_level <= 50 ? "text-warning" : "text-success")} />
                  <span>{device.battery_level}%</span>
                  <span className="text-border">•</span>
                </>
              )}
              <span>עדכון {formatLastSeen(device?.last_seen ?? null)}</span>
              {isRefreshing && (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              )}
              {device && (
                <button onClick={handleRequestSync} disabled={syncStatus === "locating"}
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50">
                  <RefreshCw className={cn("w-3 h-3", syncStatus === "locating" && "animate-spin")} />
                  <span className="text-[11px]">{syncStatus === "locating" ? "מעדכן..." : syncStatus === "success" ? "עודכן ✓" : "רענן"}</span>
                </button>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setShowReconnectModal(true)}
            title="צור קישור חיבור חדש"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <ProtectionCenterOverview
          childName={child?.name || ""}
          status={status}
          currentUsageMinutes={totalUsageFromDb}
          dailyLimitMinutes={screenTimeLimit}
          todayBonusMinutes={todayBonusMinutes}
          installedAppsCount={installedApps.length}
          blockedAppsCount={blockedAppsCount}
          pendingAppsCount={pendingAppsCount}
          activeSchedulesCount={activeSchedulesCount}
          activeRestrictionName={activeRestrictionName}
          hasLocation={hasLocation}
          deviceHealth={deviceHealth}
        />

        {/* Smart Protection remains separate from parental-control navigation. */}
        {V2_GUARDIAN_ALERTS_ENABLED && (
          <Card className="border-border shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm text-foreground">הגנה חכמה</span>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary">
                  WhatsApp
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{unacknowledgedAlerts}</p>
                  <p className="text-[11px] text-muted-foreground">התראות פתוחות</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{todayAlerts}</p>
                  <p className="text-[11px] text-muted-foreground">התראות היום</p>
                </div>
                <div>
                  <div className={cn("w-2.5 h-2.5 rounded-full mx-auto mb-1", isMonitoringActive ? "bg-success" : "bg-border")} />
                  <p className="text-[11px] text-muted-foreground">{isMonitoringActive ? "ניטור פעיל" : "ניטור לא פעיל"}</p>
                </div>
              </div>
              {unacknowledgedAlerts > 0 && (
                <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => navigate("/alerts-v2")}>
                  <Bell className="w-3.5 h-3.5 ml-1.5" />
                  צפה בהתראות
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        {/* ===== 4-9. EXISTING SECTIONS (reused) ===== */}
        {device ? (
          <div className="space-y-4">
            <ProblemBanner deviceHealth={deviceHealth} status={status} lastSeen={device.last_seen} />

            <section id="screen-time" className="scroll-mt-20 space-y-4">
              <ScreenTimeSection
                appUsage={appUsage}
                screenTimeLimit={screenTimeLimit}
                currentUsageMinutes={totalUsageFromDb}
                todayBonusMinutes={todayBonusMinutes}
                onUpdateLimit={async (minutes) => { await updateDailyLimit(minutes); setScreenTimeLimit(minutes); }}
                onGrantBonus={grantBonusTime}
              />
            </section>

            <section id="schedules" className="scroll-mt-20">
              <SchedulesSection
                scheduleWindows={scheduleWindows}
                onToggleShabbat={toggleShabbat}
                onUpdateShabbatMode={updateShabbatMode}
                onCreateSchedule={createSchedule}
                onUpdateSchedule={updateSchedule}
                onDeleteSchedule={deleteSchedule}
              />
            </section>

            <section id="apps" className="scroll-mt-20">
              <AppsSection
                childId={childId!}
                childName={child?.name || ""}
                appPolicies={appPolicies}
                appUsage={appUsage}
                blockedAttempts={blockedAttempts}
                installedApps={installedApps}
                onToggleBlock={toggleAppBlock}
                onApproveApp={approveApp}
                onBlockApp={blockApp}
              />
            </section>

            <section id="location" className="scroll-mt-20 space-y-4">
              <LocationSectionV2
                device={device}
                childName={child?.name || ""}
                childGender={child?.gender}
                locateStatus={locateStatus}
                showMap={showMap}
                setShowMap={setShowMap}
                handleLocateNow={handleLocateNow}
                getLocateButtonContent={getLocateButtonContent}
                ringPhase={ringPhase}
                handleRingDevice={handleRingDevice}
                handleRetryRing={retryRing}
              />

              <GeofenceSection
                childId={childId!}
                deviceLatitude={device?.latitude}
                deviceLongitude={device?.longitude}
                deviceAddress={device?.address}
              />
            </section>

            {/* ===== Lost Mode — emergency device lock ===== */}
            <section id="lost-mode" className="scroll-mt-20">
              <LostModeV2Section childId={childId!} childName={child?.name || ""} />
            </section>


            {/* ===== 12. DEVICE HEALTH ===== */}
            <section id="device-health" className="scroll-mt-20">
              {deviceHealth && <DeviceHealthBanner health={deviceHealth} />}
              {!deviceHealth && (
                <Card className="border-border shadow-sm bg-card">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground text-center py-2">אין נתוני בריאות זמינים</p>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        ) : (
          <Card className="border-border shadow-sm bg-card">
            <CardContent className="py-12 text-center">
              <Smartphone className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1 text-foreground">אין מכשיר מחובר</h3>
              <p className="text-sm text-muted-foreground mb-4">
                כדי להתחיל לנהל את {child?.name}, יש לחבר מכשיר
              </p>
              <Button variant="outline" onClick={() => setShowReconnectModal(true)}>
                <RefreshCw className="w-4 h-4 ml-2" />
                חבר מכשיר
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {child && (
        <ReconnectChildV2Modal
          childId={showReconnectModal ? child.id : null}
          childName={child.name}
          onClose={() => setShowReconnectModal(false)}
        />
      )}

      <BottomNavigationV2 />
    </div>
  );
}
