import { Shield, Bell, BarChart3, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  childrenData: ChildWithData[];
}

export const SmartProtectionSummary = ({ childrenData }: Props) => {
  const navigate = useNavigate();

  const hasPremium = childrenData.some(
    (c) => c.subscription_tier === "premium" || c.subscription_tier === "pro"
  );

  // If no premium children at all, show a compact upgrade prompt
  if (!hasPremium) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground/80">הגנה חכמה</h2>
        <div className="rounded-2xl bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
              <Crown className="h-4 w-4 text-warning" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">ניטור AI של WhatsApp</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                שדרגו לפרימיום כדי לקבל התראות חכמות על תכנים מסוכנים
              </p>
            </div>
            <button
              onClick={() => navigate("/checkout")}
              className="shrink-0 px-3 py-1.5 bg-warning text-white text-xs font-semibold rounded-lg hover:bg-warning transition-colors"
            >
              שדרוג
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Premium path: show real monitoring status
  const anyConnected = childrenData.some((c) => {
    if (!c.device?.last_seen) return false;
    return Date.now() - new Date(c.device.last_seen).getTime() < 24 * 60 * 60 * 1000;
  });

  const monitoringActive = anyConnected;

  // Use the same filtered alert count used elsewhere (unacknowledgedAlerts)
  const totalActionableAlerts = childrenData.reduce(
    (s, c) => s + c.unacknowledgedAlerts,
    0
  );

  const totalScanned = childrenData.reduce(
    (s, c) => s + (c.snapshot?.messages_scanned ?? 0),
    0
  );

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground/80">הגנה חכמה</h2>
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Shield
            className={`h-4 w-4 ${monitoringActive ? "text-emerald-500" : "text-muted-foreground"}`}
          />
          <span className="text-xs font-medium text-foreground/80">
            ניטור WhatsApp:{" "}
            <span className={monitoringActive ? "text-success" : "text-muted-foreground"}>
              {monitoringActive ? "פעיל" : "מנותק"}
            </span>
          </span>
        </div>

        {/* Metrics row — use consistent alert count */}
        <div className="flex gap-4">
          {totalScanned > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              <span>{totalScanned} הודעות נסרקו</span>
            </div>
          )}
          {totalActionableAlerts > 0 && (
            <button
              onClick={() => navigate("/alerts-v2")}
              className="flex items-center gap-1.5 text-xs text-warning font-medium hover:text-warning transition-colors"
            >
              <Bell className="h-3.5 w-3.5 text-amber-400" />
              <span>{totalActionableAlerts} התראות פתוחות</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};