import { useState } from "react";
import { Shield, Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAppIconInfo } from "@/lib/appIcons";
import type { AppPolicy, BlockedAttemptSummary } from "@/hooks/useChildControls";

interface AppUsageEntry {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

interface AppControlsListProps {
  childName: string;
  appPolicies: AppPolicy[];
  appUsage: AppUsageEntry[];
  blockedAttempts: BlockedAttemptSummary[];
  onToggleBlock: (packageName: string, appName: string | null, currentlyBlocked: boolean) => Promise<void>;
}

// System apps to hide from controls
const SYSTEM_APPS_TO_HIDE = [
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
  "com.android.bluetooth",
  "com.android.nfc",
  "com.samsung.android.lool",
  "com.facebook.appmanager",
  "com.android.vending",
  "com.google.android.packageinstaller",
];

const isSystemApp = (pkg: string) =>
  SYSTEM_APPS_TO_HIDE.some((s) => pkg.toLowerCase().startsWith(s.toLowerCase())) ||
  pkg.toLowerCase().includes("systemui") ||
  pkg.toLowerCase().includes("devicecare");

export function AppControlsList({
  childName,
  appPolicies,
  appUsage,
  blockedAttempts,
  onToggleBlock,
}: AppControlsListProps) {
  const [togglingPkg, setTogglingPkg] = useState<string | null>(null);

  // Build a merged list: all known apps from usage + policies
  const appsMap = new Map<string, { appName: string | null; isBlocked: boolean; usageMinutes: number }>();

  // Add from usage (visible apps)
  for (const app of appUsage) {
    if (!isSystemApp(app.package_name)) {
      appsMap.set(app.package_name, {
        appName: app.app_name,
        isBlocked: false,
        usageMinutes: app.usage_minutes,
      });
    }
  }

  // Overlay policies
  for (const policy of appPolicies) {
    const existing = appsMap.get(policy.package_name);
    if (existing) {
      existing.isBlocked = policy.is_blocked;
    } else if (!isSystemApp(policy.package_name)) {
      appsMap.set(policy.package_name, {
        appName: policy.app_name,
        isBlocked: policy.is_blocked,
        usageMinutes: 0,
      });
    }
  }

  // Build attempts lookup
  const attemptsMap = new Map(blockedAttempts.map((a) => [a.package_name, a]));

  // Sort: blocked first, then by usage
  const sortedApps = Array.from(appsMap.entries()).sort((a, b) => {
    if (a[1].isBlocked !== b[1].isBlocked) return a[1].isBlocked ? -1 : 1;
    return b[1].usageMinutes - a[1].usageMinutes;
  });

  const handleToggle = async (pkg: string, appName: string | null, currentlyBlocked: boolean) => {
    setTogglingPkg(pkg);
    await onToggleBlock(pkg, appName, currentlyBlocked);
    setTogglingPkg(null);
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  };

  if (sortedApps.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" />
            אפליקציות חסומות — {childName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            אין נתוני אפליקציות זמינים עדיין
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="w-5 h-5 text-primary" />
          אפליקציות חסומות — {childName}
        </CardTitle>
        <p className="text-xs text-muted-foreground">חסימה חלה על כל המכשירים של הילד/ה</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {sortedApps.map(([pkg, app]) => {
          const iconInfo = getAppIconInfo(pkg);
          const Icon = iconInfo.icon;
          const attempts = attemptsMap.get(pkg);
          const isToggling = togglingPkg === pkg;

          return (
            <div
              key={pkg}
              className={cn(
                "flex items-center justify-between p-2.5 rounded-lg transition-colors gap-2",
                app.isBlocked ? "bg-destructive/5" : "bg-muted/30 hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: iconInfo.bgColor }}
                >
                  <Icon className="w-4 h-4" style={{ color: iconInfo.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {app.appName || pkg.split(".").pop()}
                  </p>
                  {attempts && attempts.attempts_today > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3 text-warning" />
                      <span className="text-xs text-warning">
                        {attempts.attempts_today} ניסיונות היום
                        {attempts.last_attempt && ` • ${formatTime(attempts.last_attempt)}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {app.isBlocked && (
                  <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                    חסום
                  </Badge>
                )}
                {isToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <div dir="ltr">
                    <Switch
                      checked={app.isBlocked}
                      onCheckedChange={() => handleToggle(pkg, app.appName, app.isBlocked)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
