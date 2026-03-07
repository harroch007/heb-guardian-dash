import { Shield, ShieldAlert, ShieldCheck, Smartphone, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DeviceHealthInfo } from "@/hooks/useChildControls";
import { formatLastSeen } from "@/lib/deviceStatus";

interface DeviceHealthBannerProps {
  health: DeviceHealthInfo;
}

const PERMISSION_LABELS: Record<string, string> = {
  accessibilityEnabled: "שירות נגישות",
  notificationListenerEnabled: "האזנה להתראות",
  usageStatsGranted: "סטטיסטיקת שימוש",
  locationPermissionGranted: "מיקום",
  locationServicesEnabled: "שירותי מיקום",
  batteryOptimizationIgnored: "אופטימיזציית סוללה",
};

export function DeviceHealthBanner({ health }: DeviceHealthBannerProps) {
  const { permissions, deviceVersion, deviceModel, reportedAt } = health;

  const allPermissions = Object.entries(PERMISSION_LABELS);
  const missingPermissions = allPermissions.filter(
    ([key]) => permissions[key] === false
  );
  const allGranted = missingPermissions.length === 0;

  // WhatsApp health: needs both accessibility + notification listener
  const whatsappHealthy =
    permissions.accessibilityEnabled === true &&
    permissions.notificationListenerEnabled === true;

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
          {/* WhatsApp health indicator */}
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
        </div>

        {/* Missing permissions list */}
        {!allGranted && (
          <div className="flex flex-wrap gap-1.5">
            {missingPermissions.map(([key, label]) => (
              <Badge
                key={key}
                variant="outline"
                className="text-xs border-warning/40 text-warning bg-warning/10"
              >
                {label}
              </Badge>
            ))}
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
