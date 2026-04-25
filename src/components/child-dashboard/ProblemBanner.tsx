import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceHealthInfo } from "@/hooks/useChildControls";
import type { DeviceStatus } from "@/lib/deviceStatus";
import { WHATSAPP_MONITORING_ENABLED } from "@/config/featureFlags";

const WHATSAPP_PERMISSION_KEYS = ["accessibilityEnabled", "notificationListenerEnabled"];

const PERMISSION_LABELS: Record<string, string> = {
  accessibilityEnabled: "שירות נגישות",
  notificationListenerEnabled: "האזנה להתראות",
  usageStatsGranted: "סטטיסטיקת שימוש",
  locationPermissionGranted: "מיקום",
  locationServicesEnabled: "שירותי מיקום",
  batteryOptimizationIgnored: "אופטימיזציית סוללה",
  canDrawOverlays: "הצגה מעל אפליקציות",
};

interface ProblemBannerProps {
  deviceHealth: DeviceHealthInfo | null;
  status: DeviceStatus;
  lastSeen: string | null;
}

export function ProblemBanner({ deviceHealth, status, lastSeen }: ProblemBannerProps) {
  const problems: { icon: typeof AlertTriangle; text: string; detail?: string }[] = [];

  // Check device offline > 24h
  if (status === "inactive") {
    problems.push({
      icon: AlertTriangle,
      text: "המכשיר לא פעיל זמן רב",
      detail: "ייתכן שהאפליקציה הוסרה או שאין חיבור לאינטרנט",
    });
  }

  // Check missing permissions
  if (deviceHealth) {
    const missingPerms = Object.entries(deviceHealth.permissions).filter(
      ([key, val]) =>
        val === false &&
        (WHATSAPP_MONITORING_ENABLED || !WHATSAPP_PERMISSION_KEYS.includes(key))
    );
    if (missingPerms.length > 0) {
      const missingNames = missingPerms
        .map(([key]) => PERMISSION_LABELS[key] || key)
        .join(", ");
      problems.push({
        icon: ShieldAlert,
        text: `${missingPerms.length} הרשאות חסרות במכשיר`,
        detail: `חסר: ${missingNames}`,
      });
    }

    // WhatsApp monitoring broken (only when feature enabled)
    if (WHATSAPP_MONITORING_ENABLED) {
      const whatsappBroken =
        deviceHealth.permissions.accessibilityEnabled === false ||
        deviceHealth.permissions.notificationListenerEnabled === false;
      if (whatsappBroken && missingPerms.length === 0) {
        problems.push({
          icon: ShieldAlert,
          text: "ניטור הודעות לקוי",
          detail: "שירות נגישות או האזנה להתראות כבויים",
        });
      }
    }
  }

  if (problems.length === 0) return null;

  // Show only the most critical problem
  const problem = problems[0];
  const Icon = problem.icon;

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm">
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <span className="font-medium text-destructive">{problem.text}</span>
        {problem.detail && (
          <p className="text-xs mt-0.5 text-destructive/80">{problem.detail}</p>
        )}
      </div>
    </div>
  );
}
