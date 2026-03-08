import { useState } from "react";
import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppControlsList } from "@/components/controls";
import { NewAppsCard } from "@/components/dashboard/NewAppsCard";
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
}

export function AppsSection({
  childId,
  childName,
  appPolicies,
  appUsage,
  blockedAttempts,
  installedApps,
  onToggleBlock,
}: AppsSectionProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Filter app usage based on search and filter
  const filteredUsage = appUsage.filter((app) => {
    const name = (app.app_name || app.package_name).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter === "blocked") {
      return appPolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    if (filter === "top") return true; // sorted by usage already
    return true;
  });

  // Filter installed apps based on search and filter
  const filteredInstalled = installedApps.filter((app) => {
    const name = (app.app_name || app.package_name).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter === "blocked") {
      return appPolicies.some((p) => p.package_name === app.package_name && p.is_blocked);
    }
    return true;
  });

  // Filter policies for blocked-only view
  const filteredPolicies =
    filter === "blocked"
      ? appPolicies.filter((p) => p.is_blocked)
      : search
        ? appPolicies.filter((p) => {
            const name = (p.app_name || p.package_name).toLowerCase();
            return name.includes(search.toLowerCase());
          })
        : appPolicies;

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "הכל" },
    { key: "blocked", label: "חסומות" },
    { key: "top", label: "הכי בשימוש" },
    { key: "new", label: "חדשות היום" },
  ];

  const blockedTotal = appPolicies.filter((p) => p.is_blocked).length;

  return (
    <div id="apps-section" className="scroll-mt-4">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" />
            ניהול אפליקציות
            {blockedTotal > 0 && (
              <Badge variant="outline" className="text-xs border-destructive/30 text-destructive mr-auto">
                {blockedTotal} חסומות
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search + Filter chips — compact row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="חיפוש..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1 shrink-0">
              {filters.map((f) => (
                <Badge
                  key={f.key}
                  variant={filter === f.key ? "default" : "outline"}
                  className="cursor-pointer text-[10px] px-2 py-0.5"
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* New apps banner (only in "new" filter or "all") */}
          {(filter === "all" || filter === "new") && <NewAppsCard childId={childId} />}

          {/* App list — flat, no extra card wrapper */}
          {filter !== "new" && (
            <AppControlsList
              childName={childName}
              appPolicies={filteredPolicies}
              appUsage={filteredUsage}
              blockedAttempts={blockedAttempts}
              installedApps={filteredInstalled}
              onToggleBlock={onToggleBlock}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
