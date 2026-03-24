import { Shield, Bell, BarChart3, Crown } from "lucide-react";
import type { ChildWithData } from "@/pages/HomeV2";

interface Props {
  childrenData: ChildWithData[];
}

export const SmartProtectionSummary = ({ childrenData }: Props) => {
  const hasPremium = childrenData.some(
    (c) => c.subscription_tier === "premium" || c.subscription_tier === "pro"
  );
  const totalAlerts = childrenData.reduce(
    (s, c) => s + (c.snapshot?.alerts_sent ?? 0),
    0
  );
  const totalScanned = childrenData.reduce(
    (s, c) => s + (c.snapshot?.messages_scanned ?? 0),
    0
  );
  const anyConnected = childrenData.some((c) => {
    if (!c.device?.last_seen) return false;
    return Date.now() - new Date(c.device.last_seen).getTime() < 24 * 60 * 60 * 1000;
  });

  const monitoringActive = hasPremium && anyConnected;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">הגנה חכמה</h2>
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2">
          <Shield
            className={`h-4 w-4 ${monitoringActive ? "text-emerald-500" : "text-gray-400"}`}
          />
          <span className="text-xs font-medium text-gray-700">
            ניטור WhatsApp:{" "}
            <span className={monitoringActive ? "text-emerald-600" : "text-gray-500"}>
              {monitoringActive ? "פעיל" : hasPremium ? "מנותק" : "לא פעיל"}
            </span>
          </span>
          {!hasPremium && (
            <span className="mr-auto flex items-center gap-1 text-[10px] text-amber-600 font-medium">
              <Crown className="h-3 w-3" /> פרימיום
            </span>
          )}
        </div>

        {/* Metrics row */}
        {hasPremium && (
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              <span>{totalScanned} הודעות נסרקו</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Bell className="h-3.5 w-3.5 text-amber-400" />
              <span>{totalAlerts} התראות</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
