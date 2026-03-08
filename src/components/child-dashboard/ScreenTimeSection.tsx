import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DailyLimitControl } from "@/components/controls";
import { formatScreenTime } from "@/components/ScreenTimeCard";
import { getAppIconInfo } from "@/lib/appIcons";
import { cn } from "@/lib/utils";

interface AppUsageEntry {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

interface ScreenTimeSectionProps {
  appUsage: AppUsageEntry[];
  screenTimeLimit: number | null;
  currentUsageMinutes: number;
  onUpdateLimit: (minutes: number | null) => Promise<void>;
}

// System apps to filter out
const SYSTEM_FILTER = [
  "com.google.android.permissioncontroller",
  "com.android.systemui",
  "com.android.settings",
  "com.google.android.gms",
  "com.android.providers",
  "com.samsung.android.app.routines",
  "com.sec.android.app.launcher",
  "com.miui.home",
  "com.android.launcher",
  "com.android.packageinstaller",
];

const isSystem = (pkg: string) =>
  SYSTEM_FILTER.some((s) => pkg.toLowerCase().startsWith(s.toLowerCase())) ||
  pkg.toLowerCase().includes("systemui") ||
  pkg.toLowerCase().includes("devicecare");

export function ScreenTimeSection({
  appUsage,
  screenTimeLimit,
  currentUsageMinutes,
  onUpdateLimit,
}: ScreenTimeSectionProps) {
  const filteredApps = appUsage
    .filter((a) => !isSystem(a.package_name))
    .sort((a, b) => b.usage_minutes - a.usage_minutes)
    .slice(0, 7);

  const maxMinutes = filteredApps[0]?.usage_minutes || 1;

  const usagePercent =
    screenTimeLimit && screenTimeLimit > 0
      ? Math.min(100, (currentUsageMinutes / screenTimeLimit) * 100)
      : null;

  const getUsageBarColor = () => {
    if (!usagePercent) return "bg-primary";
    if (usagePercent >= 90) return "bg-destructive";
    if (usagePercent >= 70) return "bg-warning";
    return "bg-success";
  };

  return (
    <div id="screentime-section" className="space-y-4 scroll-mt-4">
      {/* Usage overview */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-primary" />
              זמן מסך היום
            </CardTitle>
            <span className="text-lg font-bold text-foreground">
              {formatScreenTime(currentUsageMinutes)}
              {screenTimeLimit && (
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {formatScreenTime(screenTimeLimit)}
                </span>
              )}
            </span>
          </div>
          {usagePercent !== null && (
            <Progress value={usagePercent} className="h-2 mt-2" />
          )}
        </CardHeader>
        <CardContent className="space-y-1.5">
          {filteredApps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין נתוני שימוש זמינים
            </p>
          )}
          {filteredApps.map((app) => {
            const iconInfo = getAppIconInfo(app.package_name);
            const Icon = iconInfo.icon;
            const barPercent = (app.usage_minutes / maxMinutes) * 100;

            return (
              <div
                key={app.package_name}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: iconInfo.bgColor }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: iconInfo.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">
                      {app.app_name || app.package_name.split(".").pop()}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 mr-2">
                      {formatScreenTime(app.usage_minutes)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", getUsageBarColor())}
                      style={{ width: `${barPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Daily limit control (existing component) */}
      <DailyLimitControl
        currentLimit={screenTimeLimit}
        currentUsageMinutes={currentUsageMinutes}
        onUpdateLimit={onUpdateLimit}
      />
    </div>
  );
}
