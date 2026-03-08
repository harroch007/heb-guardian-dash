import { Battery, Wifi, WifiOff, Shield, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatScreenTime } from "@/components/ScreenTimeCard";
import type { DeviceStatus } from "@/lib/deviceStatus";

interface StatusStripProps {
  status: DeviceStatus;
  batteryLevel: number | null;
  totalUsageMinutes: number;
  screenTimeLimit: number | null;
  blockedCount: number;
}

export function StatusStrip({
  status,
  batteryLevel,
  totalUsageMinutes,
  screenTimeLimit,
  blockedCount,
}: StatusStripProps) {
  const usagePercent =
    screenTimeLimit && screenTimeLimit > 0
      ? Math.min(100, (totalUsageMinutes / screenTimeLimit) * 100)
      : null;

  const getUsageColor = () => {
    if (!usagePercent) return "text-foreground";
    if (usagePercent >= 90) return "text-destructive";
    if (usagePercent >= 70) return "text-warning";
    return "text-success";
  };

  const getBatteryColor = () => {
    if (!batteryLevel) return "text-muted-foreground";
    if (batteryLevel <= 20) return "text-destructive";
    if (batteryLevel <= 50) return "text-warning";
    return "text-success";
  };

  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl border border-border/50 bg-card overflow-x-auto">
      {/* Connection */}
      <div className="flex items-center gap-1.5 shrink-0">
        {status === "connected" ? (
          <Wifi className="w-4 h-4 text-success" />
        ) : (
          <WifiOff className="w-4 h-4 text-muted-foreground" />
        )}
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            status === "connected" && "bg-success",
            status === "inactive" && "bg-warning",
            status === "not_connected" && "bg-destructive"
          )}
        />
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border/50" />

      {/* Battery */}
      {batteryLevel !== null && (
        <>
          <div className="flex items-center gap-1 shrink-0">
            <Battery className={cn("w-4 h-4", getBatteryColor())} />
            <span className={cn("text-xs font-medium", getBatteryColor())}>
              {batteryLevel}%
            </span>
          </div>
          <div className="w-px h-5 bg-border/50" />
        </>
      )}

      {/* Screen Time */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Clock className="w-4 h-4 text-primary shrink-0" />
        <span className={cn("text-xs font-medium whitespace-nowrap", getUsageColor())}>
          {formatScreenTime(totalUsageMinutes)}
          {screenTimeLimit ? ` / ${formatScreenTime(screenTimeLimit)}` : ""}
        </span>
        {usagePercent !== null && (
          <Progress value={usagePercent} className="h-1.5 flex-1 min-w-[40px] max-w-[100px]" />
        )}
      </div>

      {/* Blocked count */}
      {blockedCount > 0 && (
        <>
          <div className="w-px h-5 bg-border/50" />
          <div className="flex items-center gap-1 shrink-0">
            <Shield className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium text-destructive">
              {blockedCount}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
