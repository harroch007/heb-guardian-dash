

## Restructure App Filters — Show Only What's Relevant

### User's Request
Each filter tab should show only its specific apps, no overlap:
- **"הכל" (All)**: Non-system, non-blocked, non-pending apps only (approved apps the child uses)
- **"חסומות" (Blocked)**: Only blocked apps
- **"חדשות" (New)**: Only pending-approval apps
- **"הכי בשימוש" (Top)**: Only apps with `usage_minutes > 0`

### Current Problem
The "All" tab dumps every app (system, blocked, pending) into one long list. No filtering by category.

### Changes

**File: `src/components/child-dashboard/AppsSection.tsx`**
- **"all" filter**: Pass filtered lists that exclude blocked apps and pending apps. Only show apps that have a policy with `is_blocked === false`.
- **"blocked" filter**: No change (already correct).
- **"new" filter**: No change (already correct).
- **"top" filter**: Filter `appUsage` to only apps with `usage_minutes > 0`, and pass only those to the list.

**File: `src/components/controls/AppControlsList.tsx`**
- When `filter === "top"`, the component should only render apps that have usage data > 0. This is partially handled by sorting, but we need to explicitly filter out zero-usage apps.

### Specific logic changes in `AppsSection.tsx`:

For `filteredInstalled`:
```
if (filter === "all") {
  // Exclude pending and blocked
  return policyPackages.has(app.package_name) 
    && !appPolicies.some(p => p.package_name === app.package_name && p.is_blocked)
    && !isSystemApp(app.package_name);
}
if (filter === "top") {
  // Only apps with usage
  return appUsage.some(u => u.package_name === app.package_name && u.usage_minutes > 0);
}
```

For `filteredPolicies`:
```
if (filter === "all") → exclude blocked policies
if (filter === "top") → only policies whose package has usage > 0
```

For `filteredUsage`:
```
if (filter === "top") → only usage_minutes > 0
```

### Summary
Two files changed. The core idea: each tab is exclusive — "All" means approved-only, "Blocked" means blocked-only, "New" means pending-only, "Top" means has-usage-only. System apps filtered everywhere.

