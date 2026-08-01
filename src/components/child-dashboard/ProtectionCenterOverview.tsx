import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AppWindow,
  CalendarClock,
  Clock3,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DeviceHealthInfo } from "@/hooks/useChildControls";
import type { DeviceStatus } from "@/lib/deviceStatus";
import type { GuardianMonitoringState } from "@/lib/v2/guardianMonitoringService";
import { cn } from "@/lib/utils";

interface ProtectionCenterOverviewProps {
  childName: string;
  status: DeviceStatus;
  currentUsageMinutes: number;
  dailyLimitMinutes: number | null;
  todayBonusMinutes: number;
  installedAppsCount: number;
  blockedAppsCount: number;
  pendingAppsCount: number;
  activeSchedulesCount: number;
  activeRestrictionName: string | null;
  hasLocation: boolean;
  deviceHealth: DeviceHealthInfo | null;
  monitoringState: GuardianMonitoringState | null;
  newIncidentCount: number;
}

interface ProtectionArea {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "muted";
}

const statusCopy: Record<DeviceStatus, string> = {
  connected: "המכשיר מחובר והבקרה פעילה",
  inactive: "המכשיר לא דיווח לאחרונה",
  not_connected: "עדיין לא חובר מכשיר",
};

const statusBadgeCopy: Record<DeviceStatus, string> = {
  connected: "פעיל",
  inactive: "דורש בדיקה",
  not_connected: "לא מחובר",
};

const toneClasses: Record<ProtectionArea["tone"], string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted text-muted-foreground",
};

export function ProtectionCenterOverview({
  childName,
  status,
  currentUsageMinutes,
  dailyLimitMinutes,
  todayBonusMinutes,
  installedAppsCount,
  blockedAppsCount,
  pendingAppsCount,
  activeSchedulesCount,
  activeRestrictionName,
  hasLocation,
  deviceHealth,
  monitoringState,
  newIncidentCount,
}: ProtectionCenterOverviewProps) {
  const effectiveLimit =
    dailyLimitMinutes !== null && dailyLimitMinutes > 0
      ? dailyLimitMinutes + todayBonusMinutes
      : null;

  const missingPermissionCount = deviceHealth
    ? Object.values(deviceHealth.permissions).filter(
        (value) => value === false,
      ).length
    : null;

  const areas: ProtectionArea[] = [
    {
      id: "whatsapp-safety",
      label: "בטיחות ב־WhatsApp",
      value:
        newIncidentCount > 0
          ? `${newIncidentCount} התראות חדשות`
          : monitoringState === "healthy"
            ? "ניטור פעיל · אין התראות חדשות"
            : monitoringState
              ? "הניטור דורש בדיקה"
              : "ממתין לדיווח מהמכשיר",
      icon: MessageCircle,
      tone:
        newIncidentCount > 0
          ? "warning"
          : monitoringState === "healthy"
            ? "success"
            : monitoringState
              ? "warning"
              : "muted",
    },
    {
      id: "screen-time",
      label: "זמן מסך",
      value:
        effectiveLimit
          ? `${Math.round(currentUsageMinutes)} מתוך ${effectiveLimit} דק׳`
          : `${Math.round(currentUsageMinutes)} דק׳ היום`,
      icon: Clock3,
      tone: "primary",
    },
    {
      id: "apps",
      label: "אפליקציות",
      value:
        pendingAppsCount > 0
          ? `${pendingAppsCount} ממתינות להחלטה`
          : `${installedAppsCount} מותקנות · ${blockedAppsCount} חסומות`,
      icon: AppWindow,
      tone: pendingAppsCount > 0 ? "warning" : "primary",
    },
    {
      id: "schedules",
      label: "לוחות זמנים",
      value: activeRestrictionName
        ? `פעיל עכשיו: ${activeRestrictionName}`
        : activeSchedulesCount > 0
          ? `${activeSchedulesCount} לוחות פעילים`
          : "לא הוגדר לוח פעיל",
      icon: CalendarClock,
      tone: activeRestrictionName ? "success" : "muted",
    },
    {
      id: "location",
      label: "מיקום וצלצול",
      value: hasLocation ? "מיקום אחרון זמין" : "ממתין למיקום מהמכשיר",
      icon: MapPinned,
      tone: hasLocation ? "success" : "muted",
    },
    {
      id: "lost-mode",
      label: "פעולות חירום",
      value: status === "connected" ? "מצב אבוד זמין" : "זמין כשהמכשיר מתחבר",
      icon: Siren,
      tone: status === "connected" ? "primary" : "muted",
    },
    {
      id: "device-health",
      label: "תקינות והרשאות",
      value:
        missingPermissionCount === null
          ? "ממתין לדיווח תקינות"
          : missingPermissionCount > 0
            ? `${missingPermissionCount} הרשאות דורשות טיפול`
            : "כל ההרשאות שדווחו תקינות",
      icon: Activity,
      tone:
        missingPermissionCount === null
          ? "muted"
          : missingPermissionCount > 0
            ? "warning"
            : "success",
    },
  ];

  const navigateTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  };

  const controlsAvailable = status !== "not_connected";

  return (
    <Card className="border-primary/25 bg-card shadow-sm">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">
                מרכז ההגנה של {childName}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {statusCopy[status]}
              </p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 text-[10px]",
              status === "connected" && "bg-success/15 text-success",
              status === "inactive" && "bg-warning/15 text-warning",
              status === "not_connected" &&
                "bg-destructive/15 text-destructive",
            )}
          >
            {statusBadgeCopy[status]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {areas.map((area) => {
            const Icon = area.icon;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => navigateTo(area.id)}
                disabled={!controlsAvailable}
                className="min-h-20 rounded-xl border border-border bg-background/40 p-3 text-right transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background/40"
                aria-label={`מעבר אל ${area.label}`}
              >
                <span
                  className={cn(
                    "mb-2 flex h-7 w-7 items-center justify-center rounded-lg",
                    toneClasses[area.tone],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="block text-xs font-semibold text-foreground">
                  {area.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                  {area.value}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
