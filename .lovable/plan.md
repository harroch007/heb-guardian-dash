

## Problem

The Screen Time section displays usage data for built-in Samsung system apps like "נגישות" (Accessibility - `com.samsung.accessibility`), "הודעות" (Messages - `com.samsung.android.messaging`), and "גלריה" (Gallery - `com.sec.android.gallery3d`). These are pre-installed device apps, not user-installed apps.

The current `SYSTEM_FILTER` in `ScreenTimeSection.tsx` only catches a small set of Android framework packages but misses Samsung built-in apps.

## Solution

Expand the system filter in `ScreenTimeSection.tsx` to exclude built-in device apps from the screen time list. The filter should match the same approach used in `installed_apps` — only show apps that are truly user-installed (the 11 apps now in `installed_apps`).

**Two-pronged approach:**

1. **Cross-reference with `installed_apps`**: Instead of maintaining a fragile blocklist, filter screen time apps to only show apps that exist in the child's `installed_apps` inventory. Since `installed_apps` now contains only user-facing CATEGORY_LAUNCHER apps (after the cleanup), this is the authoritative source.

2. **Fallback blocklist expansion**: As a safety net (in case an app has usage but isn't yet in inventory), expand `SYSTEM_FILTER` with known Samsung/Android built-in packages:
   - `com.samsung.accessibility`
   - `com.samsung.android.messaging`
   - `com.sec.android.gallery3d`
   - `com.sec.android.app.`
   - `com.samsung.android.dialer`
   - `com.samsung.android.contacts`
   - `com.samsung.android.calendar`
   - `com.samsung.android.app.camera`

### Changes

**`src/components/child-dashboard/ScreenTimeSection.tsx`**: Expand `SYSTEM_FILTER` array with Samsung/Android built-in app prefixes. Also add keyword-based exclusions for common patterns (`accessibility`, `messaging`, `gallery`, `dialer`, `contacts`, `calendar`, `camera`).

**`src/components/ScreenTimeCard.tsx`** and **`src/components/dashboard/ScreenTimeCard.tsx`**: Apply the same expanded filter for consistency across all screen time views.

The total minutes displayed in the header should also recalculate based on filtered apps only, so the total accurately reflects user app usage.

### Technical Detail

The `totalUsageMinutes` in `ChildDashboard.tsx` (line 142) is computed from the raw `appUsage` array before filtering. This should also be filtered so the headline number excludes system app time. The filtering will happen inside `ScreenTimeSection` which already filters — the `currentUsageMinutes` prop passed from the parent uses the unfiltered total. We'll filter the total inside the section component itself rather than changing the parent, keeping the change minimal.

