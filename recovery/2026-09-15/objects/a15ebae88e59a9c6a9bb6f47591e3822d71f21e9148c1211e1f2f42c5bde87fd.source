import { useState } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/help/HelpTooltip";
import { AppControlsList } from "@/components/controls";
import { isManageableInstalledApp } from "@/lib/parental-controls/settingsService";
import type { AppPolicy, BlockedAttemptSummary, InstalledApp } from "@/hooks/useChildControls";

interface AppUsageEntry {
  app_name: string | null;
  package_name: string;
  usage_minutes: number;
}

type Filter = "all" | "blocked" | "top" | "new";

interface AppsSectionProps {
  childId: string;
  childName: string;
  appPolicies: AppPolicy[];
  appUsage: AppUsageEntry[];
  blockedAttempts: BlockedAttemptSummary[];
  installedApps: InstalledApp[];
  onToggleBlock: (packageName: string, appName: string | null, currentlyBlocked: boolean) => Promise<void>;
  onApproveApp: (packageName: string, appName: string | null) => Promise<void>;
  onBlockApp: (packageName: string, appName: string | null) => Promise<void>;
}

export function AppsSection({
  childName,
  appPolicies,
  appUsage,
  blockedAttempts,
  installedApps,
  onToggleBlock,
  onApproveApp,
  onBlockApp,
}: AppsSectionProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);

  // Inventory is the source of truth: only launchable, non-system apps can be
  // managed. Policies and usage without a matching current inventory row stay
  // out of the parent UI.
  const manageableApps = installedApps.filter(isManageableInstalledApp);
  const installedPackages = new Set(
    manageableApps.map((app) => app.package_name),
  );
  const alwaysAllowedPackages = new Set(
    appPolicies
      .filter((policy) => policy.always_allowed)
      .map((policy) => policy.package_name),
  );
  const visibleApps = manageableApps.filter(
    (app) => !alwaysAllowedPackages.has(app.package_name),
  );
  const visiblePolicies = appPolicies.filter(
    (policy) =>
      !policy.always_allowed && installedPackages.has(policy.package_name),
  );
  const policyPackages = new Set(
    visiblePolicies.map((policy) => policy.package_name),
  );
  const usagePackages = new Set(
    appUsage
      .filter(
        (usage) =>
          usage.usage_minutes > 0 &&
          installedPackages.has(usage.package_name),
      )
      .map((usage) => usage.package_name),
  );

  const pendingApps = visibleApps.filter(
    (app) => !policyPackages.has(app.package_name),
  );

  const filteredUsage = appUsage.filter((app) => {
    if (!installedPackages.has(app.package_name)) return false;
    if (alwaysAllowedPackages.has(app.package_name)) return false;
    if (filter === "blocked") {
      return visiblePolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    if (filter === "top") {
      return app.usage_minutes > 0;
    }
    if (filter === "all") {
      const policy = visiblePolicies.find((p) => p.package_name === app.package_name);
      return policy && !policy.is_blocked;
    }
    return true;
  });

  const filteredInstalled = visibleApps.filter((app) => {
    if (filter === "blocked") {
      return visiblePolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    if (filter === "new") {
      return !policyPackages.has(app.package_name);
    }
    if (filter === "all") {
      return policyPackages.has(app.package_name)
        && !visiblePolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    if (filter === "top") {
      return usagePackages.has(app.package_name);
    }
    return true;
  });

  const filteredPolicies = (() => {
    if (filter === "blocked") return visiblePolicies.filter((p) => p.is_blocked);
    if (filter === "all") return visiblePolicies.filter((p) => !p.is_blocked);
    if (filter === "top") return visiblePolicies.filter((p) => usagePackages.has(p.package_name));
    return visiblePolicies;
  })();

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "מאושרות" },
    { key: "blocked", label: "חסומות" },
    { key: "top", label: "הכי בשימוש" },
    { key: "new", label: "ממתינות לאישור", count: pendingApps.length },
  ];

  const blockedTotal = visiblePolicies.filter((p) => p.is_blocked).length;

  return (
    <div id="apps-section" className="scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="w-5 h-5 text-primary" />
              ניהול אפליקציות
              <HelpTooltip
                text="'מאושרות' — הילד/ה יכול/ה להשתמש. 'ממתינות לאישור' — אפליקציות חדשות שנחסמו עד להחלטה שלך."
                iconSize={12}
              />
            </CardTitle>
            <div className="flex items-center gap-2">
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-3">
            {blockedTotal > 0 && (
              <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                {blockedTotal} חסומות
              </Badge>
            )}
            <div className="flex gap-1">
              {filters.map((f) => (
                <Badge
                  key={f.key}
                  variant={filter === f.key ? "default" : "outline"}
                  className="cursor-pointer text-[10px] px-2 py-0.5 justify-center text-center"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Badge>
              ))}
            </div>

            <AppControlsList
              childName={childName}
              appPolicies={filteredPolicies}
              appUsage={filteredUsage}
              blockedAttempts={blockedAttempts}
              installedApps={filteredInstalled}
              onToggleBlock={onToggleBlock}
              onApproveApp={onApproveApp}
              onBlockApp={onBlockApp}
              showPendingOnly={filter === "new"}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
