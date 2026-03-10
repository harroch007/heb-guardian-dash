

## Fix: Exclude launcher/infrastructure packages from screen-time total

### Problem
The `app_usage` table contains rows for home screen launchers (`com.sec.android.app.launcher` = 508 min, `com.android.systemui` = 52 min, `com.miui.home`, etc.). These are "always on" infrastructure processes that Android Digital Wellbeing itself excludes. Including them inflates the parent total to 15:26 instead of ~5:00.

### Evidence from DB
Launcher packages currently in `app_usage`:
- `com.sec.android.app.launcher` (Samsung) — "דף הבית של One UI"
- `com.miui.home` (Xiaomi)
- `com.android.systemui` — "ממשק המערכת"

### Fix: One migration to update two views

**Update `parent_home_snapshot`** — add WHERE exclusion to `app_usage_sum` CTE:
```sql
WHERE au.package_name NOT IN (
  'com.sec.android.app.launcher',
  'com.samsung.android.app.launcher',
  'com.miui.home',
  'com.android.launcher',
  'com.android.launcher3',
  'com.huawei.android.launcher',
  'com.oppo.launcher',
  'com.android.systemui',
  'com.google.android.permissioncontroller',
  'com.google.android.gms',
  'com.google.android.gsf'
)
```

**Update `parent_daily_report`** — same exclusion in `usage_sum` CTE.

These are infrastructure-only packages (launchers, system UI chrome, background services) that no device OS counts in its screen-time total. User-facing apps like Settings, Gallery, Play Store remain included.

### No frontend changes needed
- `ScreenTimeSection.tsx` headline already uses `currentUsageMinutes` from the view
- The `SYSTEM_FILTER` / `isSystem()` in ScreenTimeSection only affects the app list display, not the total

### Files changed
- One Supabase migration: recreate both views with the launcher exclusion

