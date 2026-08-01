import type {
  GuardianMonitoringDevice,
  GuardianMonitoringState,
} from "@/lib/v2/guardianMonitoringService";

export const relativeReportTime = (value: string | null) => {
  if (!value) return "טרם התקבל דיווח";
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "עכשיו";
  if (elapsedMinutes < 60) return `לפני ${elapsedMinutes} דק׳`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "אתמול" : `לפני ${days} ימים`;
};

export const monitoringStateCopy = (
  state: GuardianMonitoringState,
): { label: string; description: string; tone: "safe" | "warning" | "danger" | "muted" } => {
  switch (state) {
    case "healthy":
      return {
        label: "הניטור פעיל",
        description: "Kippy מקבלת דיווחים ממכשיר הילד.",
        tone: "safe",
      };
    case "late":
      return {
        label: "הדיווח מתעכב",
        description: "לא התקבל דיווח בזמן הצפוי. כדאי לבדוק את המכשיר.",
        tone: "warning",
      };
    case "interrupted":
      return {
        label: "הניטור הופסק",
        description: "המכשיר אינו מנוטר כרגע ונדרשת בדיקה.",
        tone: "danger",
      };
    case "needs_setup":
      return {
        label: "נדרשת השלמת הרשאות",
        description: "אחת מהרשאות הניטור החיוניות אינה פעילה.",
        tone: "warning",
      };
    default:
      return {
        label: "ממתינים לדיווח ראשון",
        description: "לא התקבל עדיין דיווח שמאשר שהניטור פעיל.",
        tone: "muted",
      };
  }
};

export const activeProtectionCount = (device: GuardianMonitoringDevice) =>
  [
    device.accessibilityEnabled,
    device.notificationListenerEnabled,
    device.appNotificationsAllowed,
    device.batteryOptimizationExempt,
  ].filter(Boolean).length;

export const toneClasses = {
  safe: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-muted-foreground",
} as const;
