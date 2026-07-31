import { Bell, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  childrenData: ChildWithData[];
}

/** Guardian-safe V2 monitoring summary; no legacy subscription assumptions. */
export const SmartProtectionSummary = ({ childrenData }: Props) => {
  const navigate = useNavigate();
  const monitoringActive = childrenData.some((child) => {
    if (!child.device?.last_seen) return false;
    return (
      Date.now() - new Date(child.device.last_seen).getTime() <
      24 * 60 * 60 * 1000
    );
  });
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
              monitoringActive ? "text-success" : "text-muted-foreground"
            }`}
          />
          <span className="text-xs font-medium text-foreground/80">
            ניטור WhatsApp: {" "}
            <span
              className={
                monitoringActive ? "text-success" : "text-muted-foreground"
              }
            >
              {monitoringActive ? "פעיל" : "לא התקבל דיווח עדכני"}
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
