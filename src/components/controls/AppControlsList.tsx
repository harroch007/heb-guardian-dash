import { useState } from "react";
import { Loader2, AlertTriangle, Smartphone, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAppIconInfo } from "@/lib/appIcons";
import { isSystemApp } from "@/lib/appUtils";
import type { AppPolicy, BlockedAttemptSummary, InstalledApp } from "@/hooks/useChildControls";

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
  installedApps: InstalledApp[];
  onToggleBlock: (packageName: string, appName: string | null, currentlyBlocked: boolean) => Promise<void>;
  onApproveApp: (packageName: string, appName: string | null) => Promise<void>;
  onBlockApp: (packageName: string, appName: string | null) => Promise<void>;
  showPendingOnly?: boolean;
}

export function AppControlsList({
  childName,
  appPolicies,
  appUsage,
  blockedAttempts,
  installedApps,
  onToggleBlock,
  onApproveApp,
  onBlockApp,
  showPendingOnly = false,
}: AppControlsListProps) {
  const [togglingPkg, setTogglingPkg] = useState<string | null>(null);
  const [actionPkg, setActionPkg] = useState<string | null>(null);

  const hasInventory = installedApps.length > 0;
  const policyPackages = new Set(appPolicies.map((p) => p.package_name));

  // Build apps map
  const appsMap = new Map<string, { appName: string | null; isBlocked: boolean; usageMinutes: number; isPending: boolean }>();

  if (hasInventory) {
    for (const app of installedApps) {
      if (!isSystemApp(app.package_name)) {
        const hasPolicyRow = policyPackages.has(app.package_name);
        appsMap.set(app.package_name, {
          appName: app.app_name,
          isBlocked: false,
          usageMinutes: 0,
          isPending: !hasPolicyRow,
        });
      }
    }
  } else {
    for (const app of appUsage) {
      if (!isSystemApp(app.package_name)) {
        appsMap.set(app.package_name, {
          appName: app.app_name,
          isBlocked: false,
          usageMinutes: app.usage_minutes,
          isPending: false,
        });
      }
    }
  }

  if (hasInventory) {
    for (const app of appUsage) {
      const existing = appsMap.get(app.package_name);
      if (existing) existing.usageMinutes = app.usage_minutes;
    }
  }

  for (const policy of appPolicies) {
    const existing = appsMap.get(policy.package_name);
    if (existing) {
      existing.isBlocked = policy.is_blocked;
      existing.isPending = false; // has a policy row = not pending
    } else if (!isSystemApp(policy.package_name)) {
      appsMap.set(policy.package_name, {
        appName: policy.app_name,
        isBlocked: policy.is_blocked,
        usageMinutes: 0,
        isPending: false,
      });
    }
  }

  const attemptsMap = new Map(blockedAttempts.map((a) => [a.package_name, a]));

  let sortedApps = Array.from(appsMap.entries());

  // If showing pending only, filter to pending apps
  if (showPendingOnly) {
    sortedApps = sortedApps.filter(([, app]) => app.isPending);
  }

  sortedApps.sort((a, b) => {
    // Pending first
    if (a[1].isPending !== b[1].isPending) return a[1].isPending ? -1 : 1;
    if (a[1].isBlocked !== b[1].isBlocked) return a[1].isBlocked ? -1 : 1;
    return b[1].usageMinutes - a[1].usageMinutes;
  });

  const handleToggle = async (pkg: string, appName: string | null, currentlyBlocked: boolean) => {
    setTogglingPkg(pkg);
    await onToggleBlock(pkg, appName, currentlyBlocked);
    setTogglingPkg(null);
  };

  const handleApprove = async (pkg: string, appName: string | null) => {
    setActionPkg(pkg);
    await onApproveApp(pkg, appName);
    setActionPkg(null);
  };

  const handleBlock = async (pkg: string, appName: string | null) => {
    setActionPkg(pkg);
    await onBlockApp(pkg, appName);
    setActionPkg(null);
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  if (sortedApps.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="p-3 rounded-full bg-muted/50 mb-3">
          <Smartphone className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          {showPendingOnly
            ? "אין אפליקציות חדשות ממתינות לאישור"
            : "המכשיר עדיין לא דיווח על אפליקציות מותקנות"}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {showPendingOnly
            ? "כל האפליקציות אושרו או נחסמו"
            : "לאחר חיבור המכשיר, רשימת האפליקציות תופיע כאן באופן אוטומטי"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sortedApps.map(([pkg, app]) => {
        const iconInfo = getAppIconInfo(pkg);
        const Icon = iconInfo.icon;
        const attempts = attemptsMap.get(pkg);
        const isToggling = togglingPkg === pkg;
        const isActioning = actionPkg === pkg;

        return (
          <div
            key={pkg}
            className={cn(
              "flex items-center justify-between p-2.5 rounded-lg transition-colors gap-2",
              app.isPending
                ? "bg-amber-500/5 border border-amber-500/20"
                : app.isBlocked
                  ? "bg-destructive/5"
                  : "bg-muted/30 hover:bg-muted/50"
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
                {app.isPending && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 px-1.5 py-0 h-4 mt-0.5">
                    ממתינה לאישור
                  </Badge>
                )}
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
              {app.isPending ? (
                isActioning ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                      onClick={() => handleApprove(pkg, app.appName)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleBlock(pkg, app.appName)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
