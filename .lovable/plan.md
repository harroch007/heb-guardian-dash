

## Problem Analysis

The user sees "36 התראות נשלחו" in the Digital Activity card. Two root issues:

1. **Stale cached data**: The Dashboard caches snapshot data in localStorage keyed by `last_seen`. Metrics like `notify_effective_today` can change (after our duplicate fix) without `last_seen` changing, so the cached value of 36 persists.

2. **Missing real-time subscriptions**: Currently only the `alerts` table has a realtime subscription. The `device_daily_metrics` table (which provides `messages_scanned` and `stacks_sent_to_ai`) has no subscription, so those two metrics never update in real-time either.

## Plan

### Step 1: Add real-time subscription on `device_daily_metrics`

In `Dashboard.tsx`, add a second Supabase realtime channel that listens to changes on `device_daily_metrics` for the selected child's device. When a change is detected, call `fetchSnapshot(false, true)` to force-refresh (bypassing cache).

This requires knowing the `device_id` — which is available from the `snapshot` state after the first fetch.

### Step 2: Fix cache invalidation for metrics changes

Modify the `fetchSnapshot` function so that it does NOT use the `last_seen`-based cache for the three Digital Activity metrics. Two approaches:

**Option A (simpler, recommended)**: Always fetch `parent_home_snapshot` fresh — remove the `last_seen` cache-check optimization entirely. The snapshot view is lightweight (single row per child) and the cache was causing stale data issues.

**Option B**: Keep the cache but add a secondary cache key based on a metrics hash. This adds complexity.

I recommend **Option A** — always fetch fresh from `parent_home_snapshot`. The AI insights (the expensive call) should still be cached by `last_seen`, but the snapshot itself should always be fresh.

### Step 3: Invalidate stale localStorage cache

On component mount, clear any existing dashboard cache entries to ensure the first load after this fix shows fresh data.

### Technical Details

**File: `src/pages/Dashboard.tsx`**

Changes:
1. Remove `last_seen` cache check for the snapshot data (lines ~288-309). Keep the cache for AI insights only.
2. Add a second realtime subscription on `device_daily_metrics` table, filtered by the device_id from the current snapshot.
3. Clear stale cache entries on mount.

The fetch flow becomes:
```text
fetchSnapshot()
  ├─ Always fetch parent_home_snapshot (fresh metrics)
  ├─ Check last_seen for AI insights cache
  │   ├─ Changed → call generate-daily-insights
  │   └─ Same → use cached insights
  └─ Update localStorage cache
```

Realtime subscriptions:
```text
alerts (child_id=X)        → fetchSnapshot(false, true)
device_daily_metrics (device_id=Y) → fetchSnapshot(false, true)
```

No database changes needed. The view is now correct after the duplicate cleanup.

