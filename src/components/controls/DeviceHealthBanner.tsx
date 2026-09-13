import { useState } from "react";
import { ShieldAlert, ShieldCheck, Smartphone, HelpCircle, Wrench, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeviceHealthInfo } from "@/hooks/useChildControls";
import { formatLastSeen } from "@/lib/deviceStatus";
import { HelpTooltip } from "@/components/help/HelpTooltip";

interface DeviceHealthBannerProps {
  health: DeviceHealthInfo;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

interface PermissionMeta {
  label: string;
  description: string;
  fix: string;
}

const PERMISSION_META: Record<string, PermissionMeta> = {
  accessibilityEnabled: {
    label: "שירות נגישות",
    description: "מאפשר לזהות אפליקציות פתוחות, לקרוא הודעות ולחסום תוכן",
    fix: "הגדרות → נגישות → Kippy → הפעל",
  },
  notificationListenerEnabled: {
    label: "האזנה להתראות",
    description: "מאפשר לנטר הודעות נכנסות לצורך ניתוח בטיחות",
    fix: "הגדרות → התראות → גישה להתראות → Kippy → הפעל",
  },
  appNotificationsAllowed: {
    label: "התראות Kippy",
    description: "מאפשר להציג שההגנה פעילה ולהתריע כשהמערכת דורשת טיפול",
    fix: "הגדרות → אפליקציות → Kippy → התראות → אפשר",
  },
  usageStatsGranted: {
    label: "סטטיסטיקת שימוש",
    description: "מאפשר לעקוב אחרי זמן מסך ולאכוף מגבלות שימוש",
    fix: "הגדרות → אפליקציות → גישה מיוחדת → גישה לנתוני שימוש → Kippy → הפעל",
  },
  locationPermissionGranted: {
    label: "מיקום",
    description: "מאפשר לאתר את מיקום המכשיר ולהפעיל התראות גיאוגרפיות",
    fix: "הגדרות → אפליקציות → Kippy → הרשאות → מיקום → אפשר תמיד",
  },
  preciseLocationGranted: {
    label: "מיקום מדויק",
    description: "מאפשר לעדכן מיקום מדויק ולזהות כניסה או יציאה מאזור מוגדר",
    fix: "הגדרות → אפליקציות → Kippy → הרשאות → מיקום → השתמש במיקום מדויק",
  },
  locationServicesEnabled: {
    label: "שירותי מיקום",
    description: "מפעיל את ה-GPS במכשיר כדי שניתן יהיה לאתר אותו",
    fix: "הגדרות → מיקום → הפעל שירותי מיקום",
  },
  batteryOptimizationIgnored: {
    label: "אופטימיזציית סוללה",
    description: "מונע מהמערכת לסגור את Kippy ברקע כדי לחסוך סוללה",
    fix: "הגדרות → סוללה → אופטימיזציית סוללה → Kippy → לא לבצע אופטימיזציה",
  },
  packageInventoryGranted: {
    label: "רשימת אפליקציות",
    description: "מאפשר להציג להורה את האפליקציות המותקנות וליישם מדיניות אישור או חסימה",
    fix: "פתחו את Kippy במכשיר הילד והשלימו מחדש את בדיקת ההרשאות",
  },
};

export function DeviceHealthBanner({ health, expanded: controlledExpanded, onExpandedChange }: DeviceHealthBannerProps) {
  const { permissions, deviceVersion, deviceModel, reportedAt } = health;
  const [expandedInfo, setExpandedInfo] = useState<Set<string>>(new Set());
  const [expandedFix, setExpandedFix] = useState<Set<string>>(new Set());

  const allPermissions = Object.entries(PERMISSION_META);
  const missingPermissions = allPermissions.filter(([key]) => permissions[key] === false);
  const pendingPermissions = allPermissions.filter(
    ([key]) => permissions[key] === undefined,
  );
  const allGranted =
    missingPermissions.length === 0 && pendingPermissions.length === 0;

  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;

  const toggleInfo = (key: string) => {
    setExpandedInfo((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFix = (key: string) => {
    setExpandedFix((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card className={cn(
      "protection-panel border",
      allGranted ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <button type="button" className="flex min-h-11 w-full items-center justify-between text-right" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            {allGranted ? (
              <ShieldCheck className="w-5 h-5 text-success" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-warning" />
            )}
            <span className="text-right">
              <span className="block text-sm font-semibold text-foreground">הרשאות ותקינות</span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {allGranted
                  ? "כל ההרשאות פעילות"
                  : missingPermissions.length > 0
                    ? `${missingPermissions.length} הרשאות דורשות טיפול`
                    : `אין מידע על ${pendingPermissions.length} הרשאות`}
              </span>
            </span>
            <HelpTooltip text="הרשאות שהמכשיר צריך כדי שהפיצ׳רים השונים של Kippy יעבדו (זמן מסך, מיקום, חסימת אפליקציות ועוד)." iconSize={12} />
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Permissions list */}
        {expanded && (
          <div className="space-y-1.5">
            {allPermissions.map(([key, meta]) => {
              const granted = permissions[key] !== false;
              const pending = permissions[key] === undefined;
              const permissionGranted = permissions[key] === true;
              const infoOpen = expandedInfo.has(key);
              const fixOpen = expandedFix.has(key);

              return (
                <div key={key} className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs",
                  pending
                    ? "bg-muted/40"
                    : permissionGranted
                      ? "bg-success/10"
                      : "bg-warning/10"
                )}>
                  <div className="flex items-center gap-1.5">
                    {permissionGranted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    ) : pending ? (
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                    )}
                    <span className={cn(
                      "font-medium",
                      permissionGranted
                        ? "text-success"
                        : pending
                          ? "text-muted-foreground"
                          : "text-warning",
                    )}>
                      {meta.label}
                    </span>
                    <button
                      onClick={() => toggleInfo(key)}
                      className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                      aria-label={`הסבר על ${meta.label}`}
                    >
                      <HelpCircle className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {!permissionGranted && !pending && (
                      <button
                        onClick={() => toggleFix(key)}
                        className="mr-auto flex items-center gap-0.5 text-primary hover:text-primary/80 transition-colors"
                      >
                        <Wrench className="w-3 h-3" />
                        <span>מה לעשות?</span>
                      </button>
                    )}
                  </div>
                  {infoOpen && (
                    <p className="mt-1 mr-5 text-muted-foreground leading-relaxed">
                      {meta.description}
                    </p>
                  )}
                  {fixOpen && !granted && (
                    <p className="mt-1 mr-5 text-primary font-medium leading-relaxed">
                      {meta.fix}
                    </p>
                  )}
                  {pending && (
                    <p className="mt-1 mr-5 text-muted-foreground leading-relaxed">
                      ממתינים לדיווח מהמכשיר
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Device info footer */}
        {expanded && <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Smartphone className="w-3 h-3" />
            <span>{deviceModel || "מכשיר לא ידוע"}</span>
            {deviceVersion && (
              <span className="text-muted-foreground/60">• v{deviceVersion}</span>
            )}
          </div>
          {reportedAt && (
            <span>דיווח: {formatLastSeen(reportedAt)}</span>
          )}
        </div>}
      </CardContent>
    </Card>
  );
}
