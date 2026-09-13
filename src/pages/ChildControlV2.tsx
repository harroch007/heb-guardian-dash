import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { v2Supabase } from "@/integrations/supabase/v2-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useChildControls } from "@/hooks/useChildControls";
import { useRingCommand } from "@/hooks/useRingCommand";
import { useV2GuardianMonitoring } from "@/hooks/useV2GuardianMonitoring";
import type { RingPhase } from "@/hooks/useRingCommand";
import { getStatusLabel, formatLastSeen } from "@/lib/deviceStatus";
import { hasCurrentDeviceReport } from "@/lib/v2/guardianMonitoringService";
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
import { ReconnectChildV2Modal } from "@/components/ReconnectChildV2Modal";
import { RemoveChildV2Modal } from "@/components/RemoveChildV2Modal";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import { TopNavigationV2 } from "@/components/TopNavigationV2";
import {
  AppsSection,
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
  AlertTriangle,
  LocateFixed,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
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
  const scopeKey = `${user?.id ?? ""}:${familyId ?? ""}:${childId ?? ""}`;
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const fetchGeneration = useRef(0);
  const [loadedScope, setLoadedScope] = useState("");
  const [dataError, setDataError] = useState(false);
  const [screenTimeLimit, setScreenTimeLimit] = useState<number | null>(null);
  const [totalUsageFromDb, setTotalUsageFromDb] = useState(0);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState(0);
  const [todayAlerts, setTodayAlerts] = useState(0);

  // Child management state
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setShowReconnectModal(false);
    setShowRemoveModal(false);
  }, [scopeKey]);

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
  const [openProtectionSection, setOpenProtectionSection] = useState<string | null>(null);

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
    setAppDailyLimit,
    updateDailyLimit,
    grantBonusTime,
    toggleShabbat,
    updateShabbatMode,
    createSchedule,
    updateSchedule,
    deleteSchedule,
  } = useChildControls(childId);
  const {
    children: monitoringChildren,
  } = useV2GuardianMonitoring();

  const monitoringChild = monitoringChildren.find(
    (candidate) => candidate.id === childId,
  );
  const monitoringDevice = monitoringChild?.device ?? null;
  const status = !device
    ? "not_connected"
    : monitoringDevice &&
        hasCurrentDeviceReport(monitoringDevice.monitoringState)
      ? "connected"
      : "inactive";

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

  // ---------- Canonical V2 data fetching ----------
  const fetchData = useCallback(async (isPolling = false) => {
    const generation = ++fetchGeneration.current;
    const isCurrent = () => currentScope.current === scopeKey && fetchGeneration.current === generation;
    if (!childId || !user || !familyId) {
      setLoading(false);
      return;
    }
    if (!isPolling) {
      setLoading(true);
      setDataError(false);
    }
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

      if (!isCurrent()) return;
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
        if (!isCurrent()) return;
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

      if (!isCurrent()) return;
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
      setDataError(false);
    } catch (error) {
      if (!isCurrent()) return;
      console.error("[ChildControlV2] Failed to load V2 data", error);
      if (!isPolling) setDataError(true);
    } finally {
      if (isCurrent()) {
        setLoadedScope(scopeKey);
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [childId, user, familyId, navigate, scopeKey]);

  const handleDeviceConnected = useCallback(() => {
    void fetchData(true);
    void refreshMonitoring({ silent: true });
  }, [fetchData, refreshMonitoring]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  // Polling every 30s (aligned with sync-triggers memory)
  useEffect(() => {
    if (!childId || !user) return;
    const interval = setInterval(() => {
      void fetchData(true);
      void refreshMonitoring({ silent: true });
    }, 30_000);
    return () => clearInterval(interval);
  }, [childId, user, fetchData, refreshMonitoring]);

  // Refresh immediately when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchData(true);
        void refreshMonitoring({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [fetchData, refreshMonitoring]);

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
        () => {
          void fetchData(true);
          void refreshMonitoring({ silent: true });
        },
      )
      .subscribe();
    return () => {
      void v2Supabase.removeChannel(channel);
    };
  }, [childId, fetchData, refreshMonitoring]);

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
        () => {
          void fetchData(true);
          void refreshMonitoring({ silent: true });
        },
      )
      .subscribe();
    return () => {
      void v2Supabase.removeChannel(channel);
    };
  }, [device?.device_id, fetchData, refreshMonitoring]);

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
    void fetchData(true);
    void refreshMonitoring({ silent: true });
  }, [fetchData, refreshMonitoring]);

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
  getActiveScheduleName();

  if (loading || (loadedScope !== scopeKey && !dataError)) {
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

  if (dataError || !child || loadedScope !== scopeKey || child.id !== childId) {
    return (
      <div className="v2-dark min-h-screen pb-24" dir="rtl">
        <TopNavigationV2 />
        <main className="mx-auto max-w-lg px-4 py-10">
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="space-y-4 py-10 text-center">
              <AlertTriangle className="mx-auto h-9 w-9 text-warning" />
              <h1 className="font-semibold text-foreground">
                לא הצלחנו לטעון את מרכז ההגנה
              </h1>
              <p className="text-sm text-muted-foreground">
                לא בוצע שינוי בהגדרות. אפשר לנסות שוב.
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => navigate("/home-v2")}>
                  חזרה לבית
                </Button>
                <Button onClick={() => void fetchData(false)}>
                  <RefreshCw className="ml-2 h-4 w-4" />
                  ניסיון נוסף
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <BottomNavigationV2 />
      </div>
    );
  }

  return (
    <div className="v2-dark min-h-screen pb-24" dir="rtl">
      <TopNavigationV2 />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* ===== 1. CHILD HEADER ===== */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home-v2")} className="shrink-0 h-9 w-9">
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">מרכז ההגנה</p>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold truncate text-foreground">{child.name}</h1>
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
            title="חיבור מחדש באמצעות קוד לאימייל"
            aria-label={`חיבור מחדש עבור ${child.name}`}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* ===== 4-9. EXISTING SECTIONS (reused) ===== */}
        {device ? (
          <Card className="overflow-hidden border-primary/20 bg-card shadow-sm">
            <div className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">הגדרות ההגנה</h2>
                <p className="text-xs text-muted-foreground">כל נושא מופיע פעם אחת וניתן לפתיחה</p>
              </div>
            </div>
            <div className="protection-sections divide-y divide-border [&_.protection-panel]:rounded-none [&_.protection-panel]:border-0 [&_.protection-panel]:shadow-none">

            <section id="screen-time" className="scroll-mt-20 space-y-4">
              <ScreenTimeSection
                appUsage={appUsage}
                screenTimeLimit={screenTimeLimit}
                currentUsageMinutes={totalUsageFromDb}
                todayBonusMinutes={todayBonusMinutes}
                onUpdateLimit={async (minutes) => { await updateDailyLimit(minutes); setScreenTimeLimit(minutes); }}
                onGrantBonus={grantBonusTime}
                expanded={openProtectionSection === "screen-time"}
                onExpandedChange={(open) => setOpenProtectionSection(open ? "screen-time" : null)}
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
                onRestrictionComplete={() => navigate("/home-v2", { replace: true })}
                expanded={openProtectionSection === "schedules"}
                onExpandedChange={(open) => setOpenProtectionSection(open ? "schedules" : null)}
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
                onSetDailyLimit={setAppDailyLimit}
                expanded={openProtectionSection === "apps"}
                onExpandedChange={(open) => setOpenProtectionSection(open ? "apps" : null)}
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
                expanded={openProtectionSection === "location"}
                onExpandedChange={(open) => setOpenProtectionSection(open ? "location" : null)}
              >
                <GeofenceSection
                  childId={childId!}
                  deviceLatitude={device?.latitude}
                  deviceLongitude={device?.longitude}
                  deviceAddress={device?.address}
                  embedded
                />
              </LocationSectionV2>
            </section>

            {/* ===== Lost Mode — emergency device lock ===== */}
            <section id="lost-mode" className="scroll-mt-20">
              <LostModeV2Section childId={childId!} childName={child?.name || ""} />
            </section>


            {/* ===== 12. DEVICE HEALTH ===== */}
            <section id="device-health" className="scroll-mt-20">
              {deviceHealth && (
                <DeviceHealthBanner
                  health={deviceHealth}
                  expanded={openProtectionSection === "device-health"}
                  onExpandedChange={(open) => setOpenProtectionSection(open ? "device-health" : null)}
                />
              )}
              {!deviceHealth && (
                <Card className="protection-panel border-border shadow-sm bg-card">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground text-center py-2">אין מידע על הרשאות ותקינות</p>
                  </CardContent>
                </Card>
              )}
            </section>
            </div>
          </Card>
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
        <Card className="border-border bg-card">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">ניהול החיבור והמשפחה</h2>
            <Button variant="outline" className="min-h-11 w-full" onClick={() => setShowReconnectModal(true)}>
              חיבור מחדש
            </Button>
            <Button
              ref={removeButtonRef}
              variant="ghost"
              className="min-h-11 w-full text-destructive hover:text-destructive"
              onClick={() => setShowRemoveModal(true)}
            >
              הסרת ילד
            </Button>
          </CardContent>
        </Card>
      </div>

      {showRemoveModal && child && (
        <RemoveChildV2Modal
          key={scopeKey}
          childId={child.id}
          childName={child.name}
          triggerRef={removeButtonRef}
          onClose={() => setShowRemoveModal(false)}
          onRemoved={() => {
            if (currentScope.current !== scopeKey) return;
            setShowRemoveModal(false);
            toast({ title: "הילד הוסר מהמשפחה", description: "גישת המכשירים וקודי החיבור בוטלו." });
            navigate("/home-v2", { replace: true });
          }}
        />
      )}

      {child && (
        <ReconnectChildV2Modal
          childId={showReconnectModal ? child.id : null}
          childName={child.name}
          onClose={() => setShowReconnectModal(false)}
          onConnected={handleDeviceConnected}
        />
      )}

      <BottomNavigationV2 />
    </div>
  );
}
