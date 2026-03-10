

## Screen-Time Source-of-Truth Alignment

### Root Cause

The parent UI shows a filtered screen-time total that excludes system apps. Android enforces against the full `app_usage` sum. The correct total already exists in `parent_home_snapshot.total_usage_minutes` but is never fetched.

**Current path (broken):**
```text
parent_home_snapshot.top_apps (all apps as JSONB array)
  → ChildDashboard reduces to sum client-side
    → ScreenTimeSection filters out system apps via isSystem()
      → parent sees ~98 min instead of ~668 min
```

**Correct path (fix):**
```text
parent_home_snapshot.total_usage_minutes (full unfiltered sum, matches Android)
  → pass directly to ScreenTimeSection as currentUsageMinutes
  → app list stays filtered for display only
```

### Changes

**1. `src/pages/ChildDashboard.tsx`**
- Fetch `total_usage_minutes` alongside `top_apps` from `parent_home_snapshot`
- Store in new state `totalUsageFromDb`
- Pass `totalUsageFromDb` to `ScreenTimeSection` as `currentUsageMinutes` instead of the client-side reduced value
- Before: `currentUsageMinutes={totalUsageMinutes}` where `totalUsageMinutes = appUsage.reduce(...)`
- After: `currentUsageMinutes={totalUsageFromDb}` where `totalUsageFromDb` comes directly from DB

**2. `src/components/child-dashboard/ScreenTimeSection.tsx`**
- The headline total (`formatScreenTime(filteredTotal)`) currently uses the system-app-filtered sum
- Change: use `currentUsageMinutes` prop (the real DB total) for the headline display
- Keep `filteredApps` list and `isSystem` filter for the app list only — UX stays the same
- `filteredTotal` is no longer used for the headline; only `currentUsageMinutes` is

### No changes needed
- No Supabase migration (the view already has the correct column)
- No Android changes
- No RPC changes
- No UI redesign

### Verdicts
- Parent UI was using filtered screen-time: **yes** (double-filtered via client reduce + isSystem)
- Parent UI will now use the real enforced total: **yes** (from `parent_home_snapshot.total_usage_minutes`)
- Parent and Android screen-time source of truth aligned: **yes**

