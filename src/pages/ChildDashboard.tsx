import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { EditChildModal } from "@/components/EditChildModal";
import { ReconnectChildModal } from "@/components/ReconnectChildModal";
import {
  ArrowRight,
  Loader2,
  LocateFixed,
  Smartphone,
  X,
  QrCode,
  Trash2,
  Pencil,
  AlertTriangle,
  Battery,
  MoreVertical,
  RefreshCw,
  Unplug,
} from "lucide-react";
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
import { toast as sonnerToast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { getDeviceStatus, getStatusColor, getStatusLabel, formatLastSeen } from "@/lib/deviceStatus";
import { cn } from "@/lib/utils";
import { useChildControls } from "@/hooks/useChildControls";
import {
  ProblemBanner,
  SyncNotice,
  AppsSection,
  ScreenTimeSection,
  SchedulesSection,
  LocationSection,
} from "@/components/child-dashboard";


interface Child {
  id: string;
  name: string;
  date_of_birth: string;
  gender: string;
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

type LocateStatus = "idle" | "locating" | "success" | "failed";

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [child, setChild] = useState<Child | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [screenTimeLimit, setScreenTimeLimit] = useState<number | null>(null);
  const [totalUsageFromDb, setTotalUsageFromDb] = useState<number>(0);

  const [locateStatus, setLocateStatus] = useState<LocateStatus>("idle");
  const [locateCommandId, setLocateCommandId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [syncStatus, setSyncStatus] = useState<LocateStatus>("idle");
  const [syncCommandId, setSyncCommandId] = useState<string | null>(null);
  const syncPollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    appPolicies,
    blockedAttempts,
    deviceHealth,
    recentCommands,
    installedApps,
    scheduleWindows,
    nextShabbat,
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
    loading: controlsLoading,
  } = useChildControls(childId);

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const status = getDeviceStatus(device !== null, device?.last_seen);
  const totalUsageMinutes = appUsage.reduce((sum, app) => sum + (app.usage_minutes || 0), 0);
  const blockedCount = appPolicies.filter((p) => p.is_blocked).length;

  const fetchDashboardData = async (isPolling = false) => {
    if (!childId || !user) return;
    if (!isPolling) setLoading(true);

    const { data: childData } = await supabase
      .from("children")
      .select("*")
      .eq("id", childId)
      .eq("parent_id", user.id)
      .maybeSingle();

    if (!childData) {
      if (!isPolling) navigate("/family");
      return;
    }
    setChild(childData);

    const { data: deviceData } = await supabase
      .from("devices")
      .select("*")
      .eq("child_id", childId)
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle();

    setDevice(deviceData);

    const { data: snapshotData } = await supabase
      .from("parent_home_snapshot")
      .select("top_apps, total_usage_minutes")
      .eq("child_id", childId)
      .maybeSingle();

    if (snapshotData?.top_apps && Array.isArray(snapshotData.top_apps)) {
      setAppUsage(snapshotData.top_apps as unknown as AppUsage[]);
    }
    if (snapshotData?.total_usage_minutes != null) {
      setTotalUsageFromDb(snapshotData.total_usage_minutes);
    }

    const { data: settingsData } = await supabase
      .from("settings")
      .select("daily_screen_time_limit_minutes")
      .eq("child_id", childId)
      .maybeSingle();

    if (settingsData) {
      setScreenTimeLimit(settingsData.daily_screen_time_limit_minutes);
    }

    if (!isPolling) setLoading(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchDashboardData(false);
  }, [childId, user, navigate]);

  // Poll every 60 seconds for fresh usage data
  useEffect(() => {
    if (!childId || !user) return;
    const interval = setInterval(() => fetchDashboardData(true), 60_000);
    return () => clearInterval(interval);
  }, [childId, user]);

  useEffect(() => {
    if (!device?.device_id) return;
    const channel = supabase
      .channel(`device-${device.device_id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "devices",
        filter: `device_id=eq.${device.device_id}`,
      }, (payload) => setDevice(payload.new as Device))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [device?.device_id]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (syncPollingRef.current) clearTimeout(syncPollingRef.current);
    };
  }, []);

  useEffect(() => {
    if (!locateCommandId || locateStatus !== "locating") return;
    const startTime = Date.now();
    const TIMEOUT_MS = 2 * 60 * 1000;
    const POLL_INTERVAL = 5000;

    const pollCommand = async () => {
      const { data: commandData } = await supabase
        .from("device_commands")
        .select("status")
        .eq("id", locateCommandId)
        .single();

      if (commandData?.status === "COMPLETED") {
        const { data: updatedDevice } = await supabase
          .from("devices")
          .select("*")
          .eq("device_id", device?.device_id)
          .single();
        if (updatedDevice) {
          setDevice(updatedDevice as Device);
          setLocateStatus("success");
          setShowMap(true);
          toast({ title: "המיקום עודכן", description: "המיקום התקבל מהמכשיר בהצלחה" });
        }
        setLocateCommandId(null);
        return;
      }
      if (commandData?.status === "FAILED") {
        setLocateStatus("failed");
        setLocateCommandId(null);
        toast({ title: "שגיאה באיתור", description: "לא ניתן לקבל מיקום מהמכשיר", variant: "destructive" });
        return;
      }
      if (Date.now() - startTime > TIMEOUT_MS) {
        setLocateStatus("failed");
        setLocateCommandId(null);
        toast({ title: "המכשיר לא מגיב", description: "לא ניתן להתחבר למכשיר.", variant: "destructive" });
        return;
      }
      pollingRef.current = setTimeout(pollCommand, POLL_INTERVAL);
    };
    pollCommand();
    return () => { if (pollingRef.current) clearTimeout(pollingRef.current); };
  }, [locateCommandId, locateStatus, device?.device_id, toast]);

  // --- Request Device Sync (REPORT_HEARTBEAT) ---
  useEffect(() => {
    if (!syncCommandId || syncStatus !== "locating") return;
    const startTime = Date.now();
    const TIMEOUT_MS = 2 * 60 * 1000;
    const POLL_INTERVAL = 5000;

    const pollSync = async () => {
      const { data: commandData } = await supabase
        .from("device_commands")
        .select("status")
        .eq("id", syncCommandId)
        .single();

      if (commandData?.status === "COMPLETED") {
        setSyncStatus("success");
        setSyncCommandId(null);
        fetchDashboardData(true);
        toast({ title: "המכשיר עודכן", description: "התקבל עדכון מהמכשיר בהצלחה" });
        setTimeout(() => setSyncStatus("idle"), 5000);
        return;
      }
      if (commandData?.status === "FAILED") {
        setSyncStatus("failed");
        setSyncCommandId(null);
        toast({ title: "המכשיר לא מגיב", description: "לא ניתן לקבל עדכון מהמכשיר", variant: "destructive" });
        return;
      }
      if (Date.now() - startTime > TIMEOUT_MS) {
        setSyncStatus("failed");
        setSyncCommandId(null);
        toast({ title: "המכשיר לא מגיב", description: "לא ניתן להתחבר למכשיר.", variant: "destructive" });
        return;
      }
      syncPollingRef.current = setTimeout(pollSync, POLL_INTERVAL);
    };
    pollSync();
    return () => { if (syncPollingRef.current) clearTimeout(syncPollingRef.current); };
  }, [syncCommandId, syncStatus, toast]);

  const handleRequestSync = async () => {
    if (!device?.device_id) return;
    setSyncStatus("locating");
    const { data: command, error } = await supabase
      .from("device_commands")
      .insert({ device_id: device.device_id, command_type: "REPORT_HEARTBEAT", status: "PENDING" })
      .select("id")
      .single();
    if (error || !command) {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח בקשת עדכון", variant: "destructive" });
      setSyncStatus("failed");
      return;
    }
    setSyncCommandId(command.id);
    toast({ title: "מבקש עדכון מהמכשיר...", description: "אנא המתן, זה עשוי לקחת עד 2 דקות" });
  };

  const handleLocateNow = async () => {
    if (!device?.device_id) return;
    setLocateStatus("locating");
    setShowMap(false);
    const { data: command, error } = await supabase
      .from("device_commands")
      .insert({ device_id: device.device_id, command_type: "LOCATE_NOW", status: "PENDING" })
      .select("id")
      .single();
    if (error || !command) {
      toast({ title: "שגיאה", description: "לא ניתן לשלוח פקודת איתור", variant: "destructive" });
      setLocateStatus("failed");
      return;
    }
    setLocateCommandId(command.id);
    toast({ title: "מאתר את המכשיר...", description: "אנא המתן, זה עשוי לקחת עד 2 דקות" });
  };

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
    navigate("/family");
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

  const getLocateButtonContent = () => {
    switch (locateStatus) {
      case "locating":
        return (<><Loader2 className="w-4 h-4 animate-spin ml-2" />מאתר...</>);
      case "failed":
        return (<><AlertTriangle className="w-4 h-4 ml-2 text-destructive" />אתר עכשיו</>);
      default:
        return (<><LocateFixed className="w-4 h-4 ml-2" />אתר עכשיו</>);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/family")} className="shrink-0 h-8 w-8">
            <ArrowRight className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-bold text-foreground truncate">{child?.name}</h1>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0 h-4 shrink-0",
                  status === "connected" && "bg-success/20 text-success",
                  status === "inactive" && "bg-warning/20 text-warning",
                  status === "not_connected" && "bg-destructive/20 text-destructive",
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full ml-1", getStatusColor(status))} />
                {getStatusLabel(status)}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {device?.battery_level !== null && device?.battery_level !== undefined && (
                <>
                  <Battery className={cn("w-3 h-3", device.battery_level <= 20 ? "text-destructive" : device.battery_level <= 50 ? "text-warning" : "text-success")} />
                  <span>{device.battery_level}%</span>
                  <span className="text-border">•</span>
                </>
              )}
              <span>סונכרן {formatLastSeen(device?.last_seen ?? null)}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowEditModal(true)} className="text-muted-foreground hover:text-foreground shrink-0 h-7 w-7">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground shrink-0 h-7 w-7">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
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

        {!device ? (
          <Card className="border-muted/30 bg-muted/5">
            <CardContent className="py-12 text-center">
              <div className="relative inline-block mb-6">
                <Smartphone className="w-16 h-16 text-muted-foreground" />
                <X className="w-8 h-8 text-destructive absolute -bottom-1 -right-1" />
              </div>
              <h3 className="text-xl font-semibold mb-2">אין מכשיר מחובר</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                כדי להתחיל לעקוב אחרי {child?.name}, יש להתקין את האפליקציה על הטלפון שלו/ה ולסרוק קוד QR
              </p>
              <Button onClick={() => setShowQRModal(true)} className="glow-primary">
                <QrCode className="w-4 h-4 ml-2" />
                חבר מכשיר חדש
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <ProblemBanner
              deviceHealth={deviceHealth}
              status={status}
              lastSeen={device.last_seen}
            />

            <SyncNotice commands={recentCommands} />


            <LocationSection
              device={device}
              childName={child?.name || ""}
              locateStatus={locateStatus}
              showMap={showMap}
              setShowMap={setShowMap}
              handleLocateNow={handleLocateNow}
              getLocateButtonContent={getLocateButtonContent}
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

            <ScreenTimeSection
              appUsage={appUsage}
              screenTimeLimit={screenTimeLimit}
              currentUsageMinutes={totalUsageFromDb}
              todayBonusMinutes={todayBonusMinutes}
              onUpdateLimit={async (minutes) => {
                await updateDailyLimit(minutes);
                setScreenTimeLimit(minutes);
              }}
              onGrantBonus={grantBonusTime}
            />

            <SchedulesSection
              scheduleWindows={scheduleWindows}
              nextShabbat={nextShabbat}
              onToggleShabbat={toggleShabbat}
              onUpdateShabbatMode={updateShabbatMode}
              onCreateSchedule={createSchedule}
              onUpdateSchedule={updateSchedule}
              onDeleteSchedule={deleteSchedule}
            />
          </div>
        )}

        {showQRModal && child && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">חיבור מכשיר חדש</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowQRModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <QRCodeDisplay childId={child.id} parentId={user?.id || ""} parentEmail={user?.email || ""} onFinish={() => setShowQRModal(false)} />
            </div>
          </div>
        )}

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
      </div>
    </DashboardLayout>
  );
}
