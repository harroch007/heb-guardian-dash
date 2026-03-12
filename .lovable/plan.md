

## Fix: "New Apps" badge count mismatch

### Problem
The "חדשות 1" badge shows 1 pending app, but the list is empty. This happens because:

- **AppsSection.tsx line 43** counts pending apps as: `installedApps` without a matching `app_policies` row — no system app filtering.
- **AppControlsList.tsx line 47-50** applies `isSystemApp()` to filter out system packages before rendering.

So a system app (e.g. `com.android.vending`, `com.google.android.gms`) that has no policy row gets counted as "pending" in the badge, but is hidden from the displayed list.

### Fix
**File: `src/components/child-dashboard/AppsSection.tsx`** (line 43)

Import and apply the same system app filter used in `AppControlsList` when calculating `pendingApps`:

```typescript
const pendingApps = installedApps.filter(
  (app) => !policyPackages.has(app.package_name) && !isSystemApp(app.package_name)
);
```

Extract the `isSystemApp` logic into a shared utility (or duplicate the small helper + list) so both components use identical filtering.

### Scope
- One file change: `AppsSection.tsx`
- Either import `isSystemApp` from `AppControlsList` (requires exporting it) or move the helper + `SYSTEM_APPS_TO_HIDE` list to a shared location like `src/lib/appUtils.ts`.

