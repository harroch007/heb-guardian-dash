import { useState } from "react";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const policyPackages = new Set(appPolicies.map((p) => p.package_name));
  const pendingApps = installedApps.filter((app) => !policyPackages.has(app.package_name));

  const filteredUsage = appUsage.filter((app) => {
    if (filter === "blocked") {
      return appPolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    return true;
  });

  const filteredInstalled = installedApps.filter((app) => {
    if (filter === "blocked") {
      return appPolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    if (filter === "new") {
      return !policyPackages.has(app.package_name);
    }
    return true;
  });

  const filteredPolicies =
    filter === "blocked"
      ? appPolicies.filter((p) => p.is_blocked)
      : appPolicies;

  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "הכל" },
    { key: "blocked", label: "חסומות" },
    { key: "top", label: "הכי בשימוש" },
    { key: "new", label: "חדשות", count: pendingApps.length },
  ];

  const blockedTotal = appPolicies.filter((p) => p.is_blocked).length;

  return (
    <div id="apps-section" className="scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5 text-primary" />
              ניהול אפליקציות
            </CardTitle>
            <div className="flex items-center gap-2">
              {!expanded && blockedTotal > 0 && (
                <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                  {blockedTotal} חסומות
                </Badge>
              )}
              {!expanded && pendingApps.length > 0 && (
                <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
                  {pendingApps.length} חדשות
                </Badge>
              )}
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
                  className="cursor-pointer text-[10px] px-2 py-0.5"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  {f.count !== undefined && f.count > 0 && (
                    <span className="mr-1 bg-amber-500/20 text-amber-600 rounded-full px-1 text-[9px]">
                      {f.count}
                    </span>
                  )}
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
