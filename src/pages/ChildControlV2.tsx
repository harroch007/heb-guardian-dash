import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useChildControls } from "@/hooks/useChildControls";
import { getDeviceStatus, getStatusColor, getStatusLabel, formatLastSeen } from "@/lib/deviceStatus";
import type { DeviceHealthInfo } from "@/hooks/useChildControls";
import { cn, getIsraelDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditChildModal } from "@/components/EditChildModal";
import { ReconnectChildModal } from "@/components/ReconnectChildModal";
import { BottomNavigationV2 } from "@/components/BottomNavigationV2";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ProblemBanner,
  SyncNotice,
  AppsSection,
  ScreenTimeSection,
  SchedulesSection,
  LocationSection,
  TimeRequestsCard,
} from "@/components/child-dashboard";
import {
  ArrowRight,
  Loader2,
  Battery,
  RefreshCw,
  Volume2,
  Clock,
  MapPin,
  Shield,
  Gift,
  CheckCircle2,
  AlertTriangle,
  LocateFixed,
  Bell,
  ListChecks,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  MessageCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Unplug,
  Crown,
} from "lucide-react";

// ---------- PERMISSION LABELS ----------
const PERMISSION_LABELS: Record<string, string> = {
  accessibilityEnabled: "שירות נגישות",
  notificationListenerEnabled: "האזנה להתראות",
  usageStatsGranted: "סטטיסטיקת שימוש",
  locationPermissionGranted: "מיקום",
  locationServicesEnabled: "שירותי מיקום",
  batteryOptimizationIgnored: "אופטימיזציית סוללה",
  canDrawOverlays: "הצגה מעל אפליקציות",
};

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

export default function ChildControlV2() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [child, setChild] = useState<Child | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenTimeLimit, setScreenTimeLimit] = useState<number | null>(null);
  const [totalUsageFromDb, setTotalUsageFromDb] = useState(0);
  const [rewardBankBalance, setRewardBankBalance] = useState(0);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState(0);
  const [todayAlerts, setTodayAlerts] = useState(0);
  const [activeChoresCount, setActiveChoresCount] = useState(0);
  const [completedTodayChoresCount, setCompletedTodayChoresCount] = useState(0);
  const [pendingTimeRequests, setPendingTimeRequests] = useState(0);

  // Child management state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Command statuses
  const [locateStatus, setLocateStatus] = useState<CommandStatus>("idle");
  const [locateCommandId, setLocateCommandId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [syncStatus, setSyncStatus] = useState<CommandStatus>("idle");
  const [syncCommandId, setSyncCommandId] = useState<string | null>(null);
  const syncPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ringStatus, setRingStatus] = useState<CommandStatus>("idle");
  const [ringCommandId, setRingCommandId] = useState<string | null>(null);
  const ringPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showMap, setShowMap] = useState(false);

  const {
    appPolicies,
    blockedAttempts,
    deviceHealth,
    recentCommands,
    installedApps,
    scheduleWindows,
    todayBonusMinutes,
    toggleAppBlock,
    approveApp,
    blockApp,
    updateDailyLimit,
    grantBonusTime,
    toggleShabbat,
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
  const fetchData = useCallback(async (isPolling = false) => {
    if (!childId || !user) return;
    if (!isPolling) setLoading(true);

    const todayIsrael = getIsraelDate();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [childRes, deviceRes, snapshotRes, settingsRes, bankRes, alertsRes, alertsTodayRes, timeReqRes, choresActiveRes, choresDoneRes] = await Promise.all([
      supabase.from("children").select("id, name, date_of_birth, gender, subscription_tier, pairing_code").eq("id", childId).eq("parent_id", user.id).maybeSingle(),
      supabase.from("devices").select("*").eq("child_id", childId).order("last_seen", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("parent_home_snapshot").select("top_apps, total_usage_minutes").eq("child_id", childId).maybeSingle(),
      supabase.from("settings").select("daily_screen_time_limit_minutes").eq("child_id", childId).maybeSingle(),
      supabase.from("reward_bank").select("balance_minutes").eq("child_id", childId).maybeSingle(),
      supabase.from("alerts").select("id").eq("child_id", childId).is("acknowledged_at", null).eq("is_processed", true).eq("alert_type", "warning"),
      supabase.from("alerts").select("id").eq("child_id", childId).gte("created_at", todayStart.toISOString()),
      supabase.from("time_extension_requests").select("id").eq("child_id", childId).eq("status", "pending"),
      supabase.from("chores").select("id").eq("child_id", childId).eq("status", "pending"),
      supabase.from("chores").select("id, completed_at").eq("child_id", childId).in("status", ["completed_by_child", "approved"]),
    ]);

    if (!childRes.data) {
      if (!isPolling) navigate("/home-v2");
      return;
    }

    setChild(childRes.data as Child);
    setDevice(deviceRes.data as Device | null);

    if (snapshotRes.data?.top_apps && Array.isArray(snapshotRes.data.top_apps)) {
      setAppUsage(snapshotRes.data.top_apps as unknown as AppUsage[]);
    }
    setTotalUsageFromDb(snapshotRes.data?.total_usage_minutes ?? 0);
    setScreenTimeLimit(settingsRes.data?.daily_screen_time_limit_minutes ?? null);
    setRewardBankBalance(bankRes.data?.balance_minutes ?? 0);
    setUnacknowledgedAlerts(alertsRes.data?.length ?? 0);
    setTodayAlerts(alertsTodayRes.data?.length ?? 0);
    setPendingTimeRequests(timeReqRes.data?.length ?? 0);
    setActiveChoresCount(choresActiveRes.data?.length ?? 0);

    const doneToday = (choresDoneRes.data || []).filter(
      (c: any) => c.completed_at && new Date(c.completed_at) >= todayStart
    ).length;
    setCompletedTodayChoresCount(doneToday);

    if (!isPolling) setLoading(false);
  }, [childId, user, navigate]);

  useEffect(() => { fetchData(false); }, [fetchData]);
  useEffect(() => {
    if (!childId || !user) return;
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [childId, user, fetchData]);

  // ---------- Real-time device subscription ----------
  useEffect(() => {
    if (!device?.device_id) return;
    const channel = supabase
      .channel(`cv2-device-${device.device_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `device_id=eq.${device.device_id}` },
        (payload) => setDevice(payload.new as Device))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [device?.device_id]);

  // ---------- Cleanup polling ----------
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (syncPollingRef.current) clearTimeout(syncPollingRef.current);
      if (ringPollingRef.current) clearTimeout(ringPollingRef.current);
    };
  }, []);

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
        const { data } = await supabase.from("device_commands").select("status").eq("id", commandId).single();
        if (data?.status === "COMPLETED") {
          setStatus("success");
          setCommandId(null);
          onSuccess?.();
          if (successMessage) toast({ title: successMessage.title, description: successMessage.desc });
          setTimeout(() => setStatus("idle"), 5000);
          return;
        }
        if (data?.status === "FAILED") {
          setStatus("failed");
          setCommandId(null);
          if (failMessage) toast({ title: failMessage.title, description: failMessage.desc, variant: "destructive" });
          return;
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
    }, [commandId, commandStatus]);
  };

  // Locate polling
  useCommandPolling(locateCommandId, locateStatus, setLocateStatus, setLocateCommandId, pollingRef,
    async () => {
      if (!device?.device_id) return;
      const { data: updated } = await supabase.from("devices").select("*").eq("device_id", device.device_id).single();
      if (updated) { setDevice(updated as Device); setShowMap(true); }
    },
    { title: "המיקום עודכן", desc: "המיקום התקבל מהמכשיר בהצלחה" },
    { title: "שגיאה באיתור", desc: "לא ניתן לקבל מיקום מהמכשיר" },
  );

  // Sync polling
  useCommandPolling(syncCommandId, syncStatus, setSyncStatus, setSyncCommandId, syncPollingRef,
    () => fetchData(true),
    { title: "המכשיר עודכן", desc: "התקבל עדכון מהמכשיר בהצלחה" },
    { title: "המכשיר לא מגיב", desc: "לא ניתן לקבל עדכון מהמכשיר" },
  );

  // Ring polling
  useCommandPolling(ringCommandId, ringStatus, setRingStatus, setRingCommandId, ringPollingRef,
    undefined,
    { title: "המכשיר מצלצל", desc: "הצליל הופעל בהצלחה על המכשיר" },
    { title: "לא ניתן לצלצל", desc: "המכשיר לא הצליח להשמיע צליל" },
  );

  const sendCommand = async (type: string, setCmd: (id: string | null) => void, setStat: (s: CommandStatus) => void) => {
    if (!device?.device_id) return;
    setStat("locating");
    const { data, error } = await supabase.from("device_commands").insert({ device_id: device.device_id, command_type: type, status: "PENDING" }).select("id").single();
    if (error || !data) {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח פקודה למכשיר", variant: "destructive" });
      setStat("failed");
      return;
    }
    setCmd(data.id);
  };

  const handleLocateNow = () => { setShowMap(false); sendCommand("LOCATE_NOW", setLocateCommandId, setLocateStatus); };
  const handleRingDevice = () => sendCommand("RING_DEVICE", setRingCommandId, setRingStatus);
  const handleRequestSync = () => sendCommand("REPORT_HEARTBEAT", setSyncCommandId, setSyncStatus);

  const getLocateButtonContent = () => {
    switch (locateStatus) {
      case "locating": return (<><Loader2 className="w-4 h-4 animate-spin ml-2" />מאתר...</>);
      case "failed": return (<><AlertTriangle className="w-4 h-4 ml-2 text-destructive" />אתר עכשיו</>);
      default: return (<><LocateFixed className="w-4 h-4 ml-2" />אתר עכשיו</>);
    }
  };

  // ---------- Child management actions ----------
  const handleDeleteChild = async () => {
    if (!childId) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_child_data", { p_child_id: childId });
    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן למחוק את הילד", variant: "destructive" });
      setDeleting(false);
      return;
    }
    toast({ title: "הילד הוסר בהצלחה", description: `כל הנתונים של ${child?.name} נמחקו` });
    navigate("/home-v2");
  };

  const handleDisconnectDevice = async () => {
    if (!device?.device_id) return;
    setDisconnecting(true);
    const { error } = await supabase.from("devices").update({ child_id: null }).eq("device_id", device.device_id);
    if (error) {
      toast({ title: "שגיאה", description: "לא ניתן לנתק את המכשיר", variant: "destructive" });
      setDisconnecting(false);
      return;
    }
    toast({ title: "המכשיר נותק", description: "המכשיר נותק בהצלחה מהילד" });
    setDevice(null);
    setDisconnecting(false);
  };

  // ---------- Active restriction ----------
  const activeRestrictionName = getActiveScheduleName();

  // ---------- Premium / monitoring ----------
  const isPremium = child?.subscription_tier === "premium";
  const isMonitoringActive = isPremium && device !== null && status === "connected";

  if (loading) {
    return (
      <div className="homev2-light min-h-screen flex items-center justify-center" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="homev2-light min-h-screen pb-24" dir="rtl">
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
              {device && (
                <button onClick={handleRequestSync} disabled={syncStatus === "locating"}
                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80 disabled:opacity-50">
                  <RefreshCw className={cn("w-3 h-3", syncStatus === "locating" && "animate-spin")} />
                  <span className="text-[11px]">{syncStatus === "locating" ? "מעדכן..." : syncStatus === "success" ? "עודכן ✓" : "רענן"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Management menu */}
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setShowEditModal(true)} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  ערוך פרטים
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowReconnectModal(true)} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  חבר מחדש
                </DropdownMenuItem>
                {device && (
                  <DropdownMenuItem onClick={handleDisconnectDevice} disabled={disconnecting} className="gap-2">
                    <Unplug className="w-4 h-4" />
                    נתק מכשיר
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                    מחק ילד
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>האם להסיר את {child?.name}?</AlertDialogTitle>
                <AlertDialogDescription className="text-right">
                  פעולה זו תמחק את כל הנתונים הקשורים לילד זה כולל: התראות, מכשירים מחוברים, ונתוני שימוש.
                  <br /><br />
                  <strong>לא ניתן לבטל פעולה זו.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteChild} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  כן, הסר
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* ===== 2. TOP CARD — Premium vs Free ===== */}
        {isPremium ? (
          /* PREMIUM: Smart Protection as top card */
          <Card className="border-border shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm text-foreground">הגנה חכמה</span>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary">
                  <Crown className="w-3 h-3 ml-1" />
                  פרימיום
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
        ) : (
          /* FREE: Status hero (screen time + bonus + restriction) */
          <Card className="border-border shadow-sm bg-card">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <Clock className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold text-foreground">{Math.round(totalUsageFromDb)} <span className="text-xs font-normal text-muted-foreground">דק׳</span></p>
                  <p className="text-[11px] text-muted-foreground">זמן מסך היום</p>
                  {screenTimeLimit && (
                    <p className="text-[10px] text-muted-foreground/70">מתוך {screenTimeLimit} דק׳</p>
                  )}
                </div>
                <div>
                  <Gift className="w-5 h-5 mx-auto mb-1 text-warning" />
                  <p className="text-lg font-bold text-foreground">{rewardBankBalance}</p>
                  <p className="text-[11px] text-muted-foreground">דקות בבנק</p>
                  {todayBonusMinutes > 0 && (
                    <p className="text-[10px] text-warning">+{todayBonusMinutes} היום</p>
                  )}
                </div>
                <div>
                  <Shield className="w-5 h-5 mx-auto mb-1 text-success" />
                  {activeRestrictionName ? (
                    <>
                      <p className="text-sm font-semibold text-success">{activeRestrictionName}</p>
                      <p className="text-[11px] text-muted-foreground">הגבלה פעילה</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-foreground">רגיל</p>
                      <p className="text-[11px] text-muted-foreground">ללא הגבלה</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* For premium, show a compact status row below the smart protection card */}
        {isPremium && (
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
              <Clock className="w-4 h-4 mx-auto mb-0.5 text-primary" />
              <p className="text-sm font-bold text-foreground">{Math.round(totalUsageFromDb)} <span className="text-[10px] font-normal text-muted-foreground">דק׳</span></p>
              <p className="text-[10px] text-muted-foreground">מסך היום</p>
            </div>
            <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
              <Gift className="w-4 h-4 mx-auto mb-0.5 text-warning" />
              <p className="text-sm font-bold text-foreground">{rewardBankBalance}</p>
              <p className="text-[10px] text-muted-foreground">בנק בונוס</p>
            </div>
            <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
              <Shield className="w-4 h-4 mx-auto mb-0.5 text-success" />
              <p className="text-[11px] font-semibold text-foreground">{activeRestrictionName || "רגיל"}</p>
              <p className="text-[10px] text-muted-foreground">{activeRestrictionName ? "הגבלה" : "ללא הגבלה"}</p>
            </div>
          </div>
        )}

        {/* ===== 3. QUICK ACTIONS ===== */}
        {device && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { icon: Volume2, label: "צלצל", action: handleRingDevice, disabled: ringStatus === "locating", active: ringStatus === "locating" },
              { icon: Gift, label: "בונוס", action: () => grantBonusTime(15) },
              { icon: MapPin, label: "מיקום", action: () => { const el = document.getElementById("location-section"); el?.scrollIntoView({ behavior: "smooth" }); } },
              { icon: Shield, label: "אפליקציות", action: () => { const el = document.getElementById("apps-section"); el?.scrollIntoView({ behavior: "smooth" }); } },
              { icon: ListChecks, label: "משימות", action: () => navigate("/chores-v2") },
            ].map((btn, i) => (
              <Button key={i} variant="outline" size="sm" onClick={btn.action} disabled={btn.disabled}
                className="flex-shrink-0 gap-1.5 text-xs">
                {btn.active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <btn.icon className="w-3.5 h-3.5" />}
                {btn.label}
              </Button>
            ))}
          </div>
        )}

        {/* ===== 4-9. EXISTING SECTIONS (reused) ===== */}
        {device ? (
          <div className="space-y-4">
            <TimeRequestsCard childId={childId!} />

            <ProblemBanner deviceHealth={deviceHealth} status={status} lastSeen={device.last_seen} />
            <SyncNotice commands={recentCommands} />

            <ScreenTimeSection
              appUsage={appUsage}
              screenTimeLimit={screenTimeLimit}
              currentUsageMinutes={totalUsageFromDb}
              todayBonusMinutes={todayBonusMinutes}
              onUpdateLimit={async (minutes) => { await updateDailyLimit(minutes); setScreenTimeLimit(minutes); }}
              onGrantBonus={grantBonusTime}
            />

            <SchedulesSection
              scheduleWindows={scheduleWindows}
              onToggleShabbat={toggleShabbat}
              onCreateSchedule={createSchedule}
              onUpdateSchedule={updateSchedule}
              onDeleteSchedule={deleteSchedule}
            />

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

            <LocationSection
              device={device}
              childName={child?.name || ""}
              locateStatus={locateStatus}
              showMap={showMap}
              setShowMap={setShowMap}
              handleLocateNow={handleLocateNow}
              getLocateButtonContent={getLocateButtonContent}
              ringStatus={ringStatus}
              handleRingDevice={handleRingDevice}
            />

            {/* ===== 10. TASKS & BONUS ===== */}
            <Card className="border-border shadow-sm bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm text-foreground">משימות ובונוס</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{activeChoresCount}</p>
                    <p className="text-[11px] text-muted-foreground">משימות פעילות</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{completedTodayChoresCount}</p>
                    <p className="text-[11px] text-muted-foreground">הושלמו היום</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{rewardBankBalance}</p>
                    <p className="text-[11px] text-muted-foreground">דקות בבנק</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => navigate("/chores-v2")}>
                  ניהול משימות
                </Button>
              </CardContent>
            </Card>

            {/* ===== 11. SMART PROTECTION — only for free users as upgrade prompt ===== */}
            {!isPremium && (
              <Card className="border-amber-200 shadow-sm bg-gradient-to-l from-amber-50 to-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Crown className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">הגנה חכמה</p>
                      <p className="text-xs text-muted-foreground">שדרגו לפרימיום כדי לקבל ניטור AI של WhatsApp</p>
                    </div>
                    <Button size="sm" onClick={() => navigate("/checkout")} className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs">
                      שדרוג
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== 12. DEVICE HEALTH ===== */}
            <Card className="border-border shadow-sm bg-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  {deviceHealth && Object.values(deviceHealth.permissions).every(v => v !== false)
                    ? <ShieldCheck className="w-5 h-5 text-success" />
                    : <ShieldAlert className="w-5 h-5 text-warning" />}
                  <span className="font-semibold text-sm text-foreground">בריאות המכשיר</span>
                </div>

                {deviceHealth ? (
                  <div className="space-y-1.5">
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                      const val = deviceHealth.permissions[key];
                      if (val === undefined) return null;
                      return (
                        <div key={key} className="flex items-center justify-between py-1">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <Badge variant="secondary" className={cn("text-[10px]",
                            val ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                            {val ? "פעיל" : "חסר"}
                          </Badge>
                        </div>
                      );
                    })}
                    {deviceHealth.reportedAt && (
                      <p className="text-[11px] text-muted-foreground/70 mt-2">
                        דיווח אחרון: {formatLastSeen(deviceHealth.reportedAt)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">אין נתוני בריאות זמינים</p>
                )}
              </CardContent>
            </Card>
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

      {/* ===== MODALS ===== */}
      {child && (
        <EditChildModal
          child={child}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onUpdated={(updatedChild) => setChild(updatedChild as Child)}
        />
      )}

      {child && user?.email && (
        <ReconnectChildModal
          childId={showReconnectModal ? child.id : null}
          childName={child.name}
          parentEmail={user.email}
          onClose={() => setShowReconnectModal(false)}
        />
      )}

      <BottomNavigationV2 />
    </div>
  );
}