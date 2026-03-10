

## Audit Result: No Lovable/Supabase Fix Needed

### Current data path (already correct)

```text
app_usage table (all rows, no filter)
  → parent_home_snapshot view: SUM(usage_minutes) with zero WHERE clauses
    → ChildDashboard.tsx fetches total_usage_minutes from view
      → passes as currentUsageMinutes to ScreenTimeSection
        → headline displays currentUsageMinutes directly
```

### Evidence

1. **View `parent_home_snapshot`** — the `app_usage_sum` CTE sums ALL `app_usage` rows for today's date, grouped by `device_id`. No system-app filter. No policy filter. No package exclusion.

2. **ChildDashboard.tsx line 469** — `currentUsageMinutes={totalUsageFromDb}` where `totalUsageFromDb` comes from `parent_home_snapshot.total_usage_minutes`.

3. **ScreenTimeSection.tsx line 146** — headline displays `formatScreenTime(currentUsageMinutes)` — the raw DB total, not the filtered app list sum.

4. **App list filtering** — `isSystem()` filter on lines 64-68 only applies to the app list display (lines 124-128), NOT the headline total.

### Why the ~48 minute gap remains

The `app_usage` table is missing rows that the device OS counts. Specifically, the Android APK does not upload usage for:
- **Kippy itself** (~76 min)
- **Play Store** (~3 min)  
- **Settings** (~3 min)

The Lovable/Supabase path faithfully displays everything in `app_usage`. The gap is an **Android upload gap**, not a display/filter gap.

### Required fix (Android-side, out of Lovable scope)

The Android usage-stats collector must include ALL packages in its upload to `upsert_app_usage`, including its own package and system utilities like Play Store and Settings.

### Sharp verdicts

- Parent display now mirrors raw uploaded device usage: **yes** (it sums all rows without filtering)
- No additional filtering remains on headline total: **yes** (confirmed in view SQL and component code)
- Parent and device OS expected to speak the same screen-time language: **no** — because the Android APK does not upload all packages. Once the APK uploads all packages, the totals will match automatically with zero Lovable changes.

### Recommendation

No code changes needed on Lovable/Supabase side. The fix must happen in the Android APK's usage reporting. Alternatively, if you want a faster fix without touching Android: have the Android APK report a single `total_os_usage_minutes` field (the raw `UsageStatsManager` daily total) in the heartbeat or a dedicated RPC, store it in a column, and display that instead of the per-app sum.

