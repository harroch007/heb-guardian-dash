import { Bell, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ChildWithData } from "@/pages/HomeV2";
import { hasCurrentDeviceReport } from "@/lib/v2/guardianMonitoringService";

interface Props {
  childrenData: ChildWithData[];
}

/** Guardian-safe V2 monitoring summary; no legacy subscription assumptions. */
export const SmartProtectionSummary = ({ childrenData }: Props) => {
  const navigate = useNavigate();
  const monitoringHealthy =
    childrenData.length > 0 &&
    childrenData.every(
      (child) => child.device?.monitoring_state === "healthy",
    );
  const hasUnavailableDevice = childrenData.some(
    (child) =>
      !child.device || !hasCurrentDeviceReport(child.device.monitoring_state),
  );
  const hasSetupIssue = childrenData.some(
    (child) => child.device?.monitoring_state === "needs_setup",
  );
  const hasRecoveringDevice = childrenData.some(
    (child) => child.device?.monitoring_state === "recovering",
  );
  const status = childrenData.length === 0
    ? { text: "טרם חובר מכשיר", tone: "text-muted-foreground" }
    : monitoringHealthy
      ? { text: "פעיל", tone: "text-success" }
    : hasUnavailableDevice
      ? { text: "לא התקבל דיווח עדכני", tone: "text-muted-foreground" }
      : hasSetupIssue
        ? { text: "נדרשת השלמת הרשאות", tone: "text-warning" }
        : hasRecoveringDevice
          ? { text: "החיבור מתאושש", tone: "text-warning" }
          : { text: "פעיל, נדרשת בדיקה נוספת", tone: "text-warning" };
  const newAlerts = childrenData.reduce(
    (total, child) => total + child.unacknowledgedAlerts,
    0,
  );

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground/80">הגנה חכמה</h2>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Shield
            className={`h-4 w-4 ${
              monitoringHealthy ? "text-success" : "text-warning"
            }`}
          />
          <span className="text-xs font-medium text-foreground/80">
            ניטור WhatsApp: {" "}
            <span
              className={status.tone}
            >
              {status.text}
            </span>
          </span>
        </div>

        {newAlerts > 0 ? (
          <button
            type="button"
            onClick={() => navigate("/alerts-v2")}
            className="flex items-center gap-1.5 text-xs font-medium text-warning"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{newAlerts} התראות חדשות שאומתו</span>
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">
            אין כרגע התראות בטיחות חדשות.
          </p>
        )}
      </div>
    </div>
  );
};
