import { useState } from "react";
import { ShieldAlert, ShieldCheck, Smartphone, MessageCircle, HelpCircle, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeviceHealthInfo } from "@/hooks/useChildControls";
import { formatLastSeen } from "@/lib/deviceStatus";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";
import { HelpTooltip } from "@/components/help/HelpTooltip";

const WHATSAPP_PERMISSION_KEYS = ["accessibilityEnabled", "notificationListenerEnabled"];

interface DeviceHealthBannerProps {
  health: DeviceHealthInfo;
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
  canDrawOverlays: {
    label: "הצגה מעל אפליקציות",
    description: "מאפשר להציג מסך חסימה כשאפליקציה חסומה",
    fix: "הגדרות → אפליקציות → גישה מיוחדת → הצגה מעל אפליקציות → Kippy → הפעל",
  },
};

export function DeviceHealthBanner({ health }: DeviceHealthBannerProps) {
  const { permissions, deviceVersion, deviceModel, reportedAt } = health;
  const [expandedInfo, setExpandedInfo] = useState<Set<string>>(new Set());
  const [expandedFix, setExpandedFix] = useState<Set<string>>(new Set());

  const allPermissions = Object.entries(PERMISSION_META).filter(
    ([key]) => WHATSAPP_MONITORING_ENABLED || !WHATSAPP_PERMISSION_KEYS.includes(key)
  );
  const missingPermissions = allPermissions.filter(([key]) => permissions[key] === false);
  const allGranted = missingPermissions.length === 0;

  const whatsappHealthy =
    permissions.accessibilityEnabled === true &&
    permissions.notificationListenerEnabled === true;

  const toggleInfo = (key: string) => {
    setExpandedInfo((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleFix = (key: string) => {
    setExpandedFix((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <Card className={cn(
      "border",
      allGranted ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allGranted ? (
              <ShieldCheck className="w-5 h-5 text-success" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-warning" />
            )}
            <span className="font-semibold text-sm text-foreground">
              {allGranted ? "כל ההרשאות פעילות" : `${missingPermissions.length} הרשאות חסרות`}
            </span>
          </div>
          {WHATSAPP_MONITORING_ENABLED && (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 text-xs",
                whatsappHealthy
                  ? "bg-success/20 text-success"
                  : "bg-destructive/20 text-destructive"
              )}
            >
              <MessageCircle className="w-3 h-3" />
              {whatsappHealthy ? "ניטור פעיל" : "ניטור לקוי"}
            </Badge>
          )}
        </div>

        {/* Permissions list */}
        {!allGranted && (
          <div className="space-y-1.5">
            {allPermissions.map(([key, meta]) => {
              const granted = permissions[key] !== false;
              const infoOpen = expandedInfo.has(key);
              const fixOpen = expandedFix.has(key);

              return (
                <div key={key} className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs",
                  granted ? "bg-success/10" : "bg-warning/10"
                )}>
                  <div className="flex items-center gap-1.5">
                    {granted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                    )}
                    <span className={cn("font-medium", granted ? "text-success" : "text-warning")}>
                      {meta.label}
                    </span>
                    <button
                      onClick={() => toggleInfo(key)}
                      className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                      aria-label={`הסבר על ${meta.label}`}
                    >
                      <HelpCircle className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {!granted && (
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
                </div>
              );
            })}
          </div>
        )}

        {/* Device info footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
        </div>
      </CardContent>
    </Card>
  );
}
