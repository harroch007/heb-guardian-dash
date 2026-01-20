import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationMap } from "@/components/LocationMap";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { EditChildModal } from "@/components/EditChildModal";
import { ScreenTimeLimitModal } from "@/components/ScreenTimeLimitModal";
import { ReconnectChildModal } from "@/components/ReconnectChildModal";
import {
  ArrowRight,
  MapPin,
  Battery,
  Loader2,
  LocateFixed,
  Copy,
  Smartphone,
  X,
  QrCode,
  User,
  Trash2,
  Pencil,
  Unplug,
  AlertTriangle,
} from "lucide-react";
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
import { ScreenTimeCard } from "@/components/ScreenTimeCard";
import { toast as sonnerToast } from "sonner";
import { useToast } from "@/hooks/use-toast";
import { getDeviceStatus, getStatusColor, getStatusLabel, formatLastSeen } from "@/lib/deviceStatus";
import { cn } from "@/lib/utils";

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
  const [showScreenTimeLimitModal, setShowScreenTimeLimitModal] = useState(false);
  const [screenTimeLimit, setScreenTimeLimit] = useState<number | null>(null);
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  const [locateStatus, setLocateStatus] = useState<LocateStatus>("idle");
  const [locateCommandId, setLocateCommandId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

  const getBatteryColor = (level: number | null) => {
    if (!level) return "text-muted-foreground";
    if (level <= 20) return "text-destructive";
    if (level <= 50) return "text-warning";
    return "text-success";
  };

  const status = getDeviceStatus(device !== null, device?.last_seen);

  useEffect(() => {
    const fetchData = async () => {
      if (!childId || !user) return;

      setLoading(true);

      const { data: childData } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .eq("parent_id", user.id)
        .maybeSingle();

      if (!childData) {
        navigate("/family");
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

      // Fetch app usage from parent_home_snapshot (same source as Dashboard)
      const { data: snapshotData } = await supabase
        .from("parent_home_snapshot")
        .select("top_apps")
        .eq("child_id", childId)
        .maybeSingle();

      if (snapshotData?.top_apps && Array.isArray(snapshotData.top_apps)) {
        const topApps = snapshotData.top_apps as unknown as AppUsage[];
        setAppUsage(topApps);
      }

      const { data: settingsData } = await supabase
        .from("settings")
        .select("daily_screen_time_limit_minutes")
        .eq("child_id", childId)
        .maybeSingle();

      if (settingsData) {
        setScreenTimeLimit(settingsData.daily_screen_time_limit_minutes);
      }

      setLoading(false);
    };

    fetchData();
  }, [childId, user, navigate]);

  useEffect(() => {
    if (!device?.device_id) return;

    const channel = supabase
      .channel(`device-${device.device_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "devices",
          filter: `device_id=eq.${device.device_id}`,
        },
        (payload) => {
          setDevice(payload.new as Device);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [device?.device_id]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
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
          toast({
            title: "המיקום עודכן",
            description: "המיקום התקבל מהמכשיר בהצלחה",
          });
        }
        setLocateCommandId(null);
        return;
      }

      if (commandData?.status === "FAILED") {
        setLocateStatus("failed");
        setLocateCommandId(null);
        toast({
          title: "שגיאה באיתור",
          description: "לא ניתן לקבל מיקום מהמכשיר",
          variant: "destructive",
        });
        return;
      }

      if (Date.now() - startTime > TIMEOUT_MS) {
        setLocateStatus("failed");
        setLocateCommandId(null);
        toast({
          title: "המכשיר לא מגיב",
          description: "לא ניתן להתחבר למכשיר. ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט.",
          variant: "destructive",
        });
        return;
      }

      pollingRef.current = setTimeout(pollCommand, POLL_INTERVAL);
    };

    pollCommand();

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [locateCommandId, locateStatus, device?.device_id, toast]);

  const handleLocateNow = async () => {
    if (!device?.device_id) return;

    setLocateStatus("locating");
    setShowMap(false);

    const { data: command, error } = await supabase
      .from("device_commands")
      .insert({
        device_id: device.device_id,
        command_type: "LOCATE_NOW",
        status: "PENDING",
      })
      .select("id")
      .single();

    if (error || !command) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לשלוח פקודת איתור",
        variant: "destructive",
      });
      setLocateStatus("failed");
      return;
    }

    setLocateCommandId(command.id);

    toast({
      title: "מאתר את המכשיר...",
      description: "אנא המתן, זה עשוי לקחת עד 2 דקות",
    });
  };

  const handleDeleteChild = async () => {
    if (!childId) return;

    setDeleting(true);

    const { error } = await supabase.rpc("delete_child_data", {
      p_child_id: childId,
    });

    if (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן למחוק את הילד",
        variant: "destructive",
      });
      setDeleting(false);
      return;
    }

    toast({
      title: "הילד הוסר בהצלחה",
      description: `כל הנתונים של ${child?.name} נמחקו`,
    });

    navigate("/family");
  };

  const handleDisconnectDevice = async () => {
    if (!device?.device_id) return;

    setDisconnecting(true);

    const { error } = await supabase.from("devices").update({ child_id: null }).eq("device_id", device.device_id);

    if (error) {
      toast({
        title: "שגיאה",
        description: "לא ניתן לנתק את המכשיר",
        variant: "destructive",
      });
      setDisconnecting(false);
      return;
    }

    toast({
      title: "המכשיר נותק",
      description: "המכשיר נותק בהצלחה מהילד",
    });

    setDevice(null);
    setDisconnecting(false);
  };

  const getLocateButtonContent = () => {
    switch (locateStatus) {
      case "locating":
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin ml-2" />
            מאתר...
          </>
        );
      case "failed":
        return (
          <>
            <AlertTriangle className="w-4 h-4 ml-2 text-destructive" />
            אתר עכשיו
          </>
        );
      default:
        return (
          <>
            <LocateFixed className="w-4 h-4 ml-2" />
            אתר עכשיו
          </>
        );
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
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/family")} className="shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Button>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {child?.gender === "male" ? (
                  <div className="p-1.5 rounded-full bg-blue-500/10">
                    <User className="w-5 h-5 text-blue-500" />
                  </div>
                ) : child?.gender === "female" ? (
                  <div className="p-1.5 rounded-full bg-pink-500/10">
                    <User className="w-5 h-5 text-pink-500" />
                  </div>
                ) : null}
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{child?.name}</h1>
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  status === "connected" && "bg-success/20 text-success",
                  status === "inactive" && "bg-warning/20 text-warning",
                  status === "not_connected" && "bg-destructive/20 text-destructive",
                )}
              >
                <div className={cn("w-2 h-2 rounded-full ml-1.5", getStatusColor(status))} />
                {getStatusLabel(status)}
              </Badge>
            </div>
            {child && (
              <p className="text-sm text-muted-foreground mt-1">
                {calculateAge(child.date_of_birth)} שנים • נראה לאחרונה: {formatLastSeen(device?.last_seen ?? null)}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowEditModal(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-5 h-5" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>האם להסיר את {child?.name}?</AlertDialogTitle>
                <AlertDialogDescription className="text-right">
                  פעולה זו תמחק את כל הנתונים הקשורים לילד זה כולל: התראות, מכשירים מחוברים, ונתוני שימוש.
                  <br />
                  <br />
                  <strong>לא ניתן לבטל פעולה זו.</strong>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteChild}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
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
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "p-4 rounded-2xl border",
                      child?.gender === "male" && "bg-blue-500/10 border-blue-500/30",
                      child?.gender === "female" && "bg-pink-500/10 border-pink-500/30",
                      !child?.gender && "bg-primary/10 border-primary/30",
                    )}
                  >
                    <User
                      className={cn(
                        "w-10 h-10",
                        child?.gender === "male" && "text-blue-500",
                        child?.gender === "female" && "text-pink-500",
                        !child?.gender && "text-primary",
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-foreground">{child?.name}</h2>
                    <p className="text-muted-foreground">{child && calculateAge(child.date_of_birth)} שנים</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {device.battery_level !== null && (
                      <div className="flex items-center gap-2">
                        <Battery className={cn("w-5 h-5", getBatteryColor(device.battery_level))} />
                        <span className="text-sm font-medium">{device.battery_level}%</span>
                      </div>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Unplug className="w-3.5 h-3.5 ml-1" />
                          נתק מכשיר
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>האם לנתק את המכשיר?</AlertDialogTitle>
                          <AlertDialogDescription className="text-right">
                            המכשיר ינותק מ-{child?.name} אך לא יימחק מהמערכת. תוכל לחבר אותו מחדש בכל עת.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row-reverse gap-2">
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDisconnectDevice}
                            disabled={disconnecting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {disconnecting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                            כן, נתק
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    מיקום אחרון
                  </CardTitle>
                  <Button
                    onClick={handleLocateNow}
                    size="sm"
                    variant={locateStatus === "failed" ? "destructive" : "outline"}
                    disabled={locateStatus === "locating"}
                  >
                    {getLocateButtonContent()}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {locateStatus === "failed" && (
                  <div className="mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                    <p className="text-sm text-destructive">
                      לא ניתן להתחבר למכשיר. ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט.
                    </p>
                  </div>
                )}

                {locateStatus === "locating" && (
                  <div className="mb-3 p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">מאתר את המכשיר...</p>
                    <p className="text-xs text-muted-foreground">זה עשוי לקחת עד 2 דקות</p>
                  </div>
                )}

                {device.latitude && device.longitude && locateStatus !== "locating" ? (
                  <>
                    {showMap && (
                      <div className="mb-3 animate-fade-in">
                        <LocationMap latitude={device.latitude} longitude={device.longitude} name={child?.name} />
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs sm:text-sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${device.latitude},${device.longitude}`);
                              sonnerToast.success("המיקום הועתק!");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5 ml-1.5" />
                            העתק
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 text-xs sm:text-sm" asChild>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${device.latitude},${device.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MapPin className="w-3.5 h-3.5 ml-1.5" />
                              מפות
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                    {!showMap && locateStatus !== "failed" && (
                      <p className="text-sm text-foreground">{device.address || "מיקום ידוע"}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">עודכן: {formatLastSeen(device.last_seen)}</p>
                  </>
                ) : (
                  locateStatus !== "locating" &&
                  locateStatus !== "failed" && <p className="text-muted-foreground text-sm">אין מיקום זמין</p>
                )}
              </CardContent>
            </Card>

            <ScreenTimeCard
              appUsage={appUsage}
              showChart={true}
              screenTimeLimit={screenTimeLimit}
              onSettingsClick={() => setShowScreenTimeLimitModal(true)}
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
              <QRCodeDisplay childId={child.id} parentId={user?.id || ""} onFinish={() => setShowQRModal(false)} />
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

        {child && (
          <ScreenTimeLimitModal
            childId={child.id}
            childName={child.name}
            open={showScreenTimeLimitModal}
            onOpenChange={setShowScreenTimeLimitModal}
            currentLimit={screenTimeLimit}
            onUpdated={setScreenTimeLimit}
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
