import { useState } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { isSystemApp } from "@/lib/appUtils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/help/HelpTooltip";
import { AppControlsList } from "@/components/controls";
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
  childId,
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

  // Filter out always_allowed apps — they should never appear in the parent UI
  const visiblePolicies = appPolicies.filter((p) => !p.always_allowed);
  const alwaysAllowedPackages = new Set(appPolicies.filter((p) => p.always_allowed).map((p) => p.package_name));

  const policyPackages = new Set(appPolicies.map((p) => p.package_name));
  const visibleInstalledApps = installedApps.filter((app) => !alwaysAllowedPackages.has(app.package_name));
  const pendingApps = visibleInstalledApps.filter((app) => !policyPackages.has(app.package_name) && !isSystemApp(app.package_name));

  const usagePackages = new Set(
    appUsage.filter((u) => u.usage_minutes > 0).map((u) => u.package_name)
  );

  const filteredUsage = appUsage.filter((app) => {
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

  const filteredInstalled = visibleInstalledApps.filter((app) => {
    if (isSystemApp(app.package_name)) return false;
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
