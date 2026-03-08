import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div id="apps-section" className="space-y-3 scroll-mt-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="חיפוש אפליקציה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-9 h-9 text-sm"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {filters.map((f) => (
          <Badge
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Badge>
        ))}
      </div>

      {/* New apps banner (only in "new" filter or "all") */}
      {(filter === "all" || filter === "new") && <NewAppsCard childId={childId} />}

      {/* App list */}
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
    </div>
  );
}
