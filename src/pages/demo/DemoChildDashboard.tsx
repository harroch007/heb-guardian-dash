import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DemoBanner } from "@/components/DemoBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationMap } from "@/components/LocationMap";
import { ScreenTimeCard } from "@/components/ScreenTimeCard";
import {
  ArrowRight,
  MapPin,
  Battery,
  LocateFixed,
  Copy,
  Bell,
  User,
  ChevronLeft,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { DEMO_CHILDREN, DEMO_DEVICE, DEMO_APP_USAGE, DEMO_RECENT_ALERTS } from "@/data/demoData";

export default function DemoChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();

  const [showMap, setShowMap] = useState(true);

  // Find child from demo data
  const child = DEMO_CHILDREN.find(c => c.id === childId) || DEMO_CHILDREN[0];
  const device = DEMO_DEVICE;
  const appUsage = DEMO_APP_USAGE;
  const recentAlerts = DEMO_RECENT_ALERTS;

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

  const formatTimeAgo = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "עכשיו";
    if (mins < 60) return `לפני ${mins} ד'`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `לפני ${hours} ש'`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  };

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "לא זמין";
    return formatTimeAgo(lastSeen);
  };

  return (
    <DashboardLayout>
      <DemoBanner />
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
                className="bg-success/20 text-success"
              >
                <div className="w-2 h-2 rounded-full ml-1.5 bg-success" />
                מחובר
              </Badge>
            </div>
            {child && (
              <p className="text-sm text-muted-foreground mt-1">
                {calculateAge(child.date_of_birth)} שנים • נראה לאחרונה: {formatLastSeen(device?.last_seen ?? null)}
              </p>
            )}
          </div>
        </div>

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
                  onClick={() => sonnerToast.info("פקודת איתור נשלחה (מצב הדגמה)")}
                  size="sm"
                  variant="outline"
                >
                  <LocateFixed className="w-4 h-4 ml-2" />
                  אתר עכשיו
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {device.latitude && device.longitude && (
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
                  <p className="text-sm text-foreground">{device.address || "מיקום ידוע"}</p>
                  <p className="text-xs text-muted-foreground mt-1">עודכן: {formatLastSeen(device.last_seen)}</p>
                </>
              )}
            </CardContent>
          </Card>

          <ScreenTimeCard
            appUsage={appUsage}
            showChart={true}
            screenTimeLimit={180}
            onSettingsClick={() => sonnerToast.info("הגדרות זמן מסך (מצב הדגמה)")}
          />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4 text-warning" />
                  התראות פתוחות
                </CardTitle>
                {recentAlerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/alerts")}
                    className="text-muted-foreground"
                  >
                    ראה הכל
                    <ChevronLeft className="w-4 h-4 mr-1" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentAlerts.length > 0 ? (
                <div className="space-y-2">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors"
                      onClick={() => navigate("/alerts")}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {alert.sender_display || alert.sender || "לא ידוע"}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(alert.created_at)}</span>
                      </div>
                      {alert.parent_message && (
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.parent_message.slice(0, 60)}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-4">אין התראות אחרונות - מצוין! ✅</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
