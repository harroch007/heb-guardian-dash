

# Plan: ChildDashboard UI Cleanup & Restructure

## Current Problems Identified

| Data Point | Currently Shown In | Should Appear |
|---|---|---|
| Connection status | Header badge + StatusStrip | Header only |
| Battery | StatusStrip | Header line |
| Last seen | Header subtitle | Header line |
| Screen time usage | StatusStrip + QuickActionsGrid + ScreenTimeSection + DailyLimitControl | ScreenTimeSection only |
| Blocked count | StatusStrip + QuickActionsGrid | AppsSection title only |
| Screen time limit | StatusStrip + QuickActionsGrid + ScreenTimeSection + DailyLimitControl | ScreenTimeSection only |

## What Changes

### 1. Merge Header + StatusStrip into one compact header

**Remove**: `StatusStrip` component entirely.
**Remove**: `QuickActionsGrid` component entirely.

**Restructure header** in `ChildDashboard.tsx` to show one compact line:

```text
← [שם הילד]  [מחובר●]        ✏️ 🗑️
   38% סוללה • סונכרן לפני 5 דק׳
```

Battery + last sync move into the subtitle line (where age currently is). Age is removed (low value, parent knows child's age). Connection badge stays.

### 2. Remove QuickActionsGrid

This component duplicates data from StatusStrip and sections below. The sections themselves have `id` anchors and are directly visible on scroll — jump links add no value on a single-scroll page.

**File**: Delete usage from `ChildDashboard.tsx`. Component file can remain but won't be imported.

### 3. Simplify ScreenTimeSection — merge DailyLimitControl inline

Currently ScreenTimeSection renders TWO cards:
- Card 1: Usage overview with progress + top apps
- Card 2: DailyLimitControl with ANOTHER progress bar

**Change**: Merge into ONE card. The progress bar and usage summary appear once at the top, followed by the limit slider (if enabled), then top apps list below.

**Files modified**: `src/components/child-dashboard/ScreenTimeSection.tsx`

### 4. Clean up AppsSection header

Remove the wrapping Card from `AppControlsList` — let AppsSection own the section title. Currently `AppControlsList` has its own `<Card>` with header "אפליקציות — {childName}" which creates a double-card visual. The section already has a clear context from its position.

**Files modified**: `src/components/controls/AppControlsList.tsx`, `src/components/child-dashboard/AppsSection.tsx`

### 5. Keep ProblemBanner + SyncNotice as-is

These are already clean — one conditional banner, one conditional sync line. No changes needed.

### 6. Keep SchedulesSection + LocationSection as-is

Both are already clean and well-structured. No changes needed.

---

## Files Changed

| File | Action |
|---|---|
| `src/pages/ChildDashboard.tsx` | Remove StatusStrip + QuickActionsGrid imports/usage. Move battery + last sync into header subtitle. |
| `src/components/child-dashboard/ScreenTimeSection.tsx` | Merge DailyLimitControl inline — single card with one progress bar, limit slider, top apps. |
| `src/components/child-dashboard/AppsSection.tsx` | Add section title "ניהול אפליקציות" with icon. |
| `src/components/controls/AppControlsList.tsx` | Remove outer Card/CardHeader wrapper — render flat list only (parent provides the card). |

**No files created. No files deleted. No new data, hooks, queries, or logic.**

---

## What Stays Out of Scope

- No DB/Supabase changes
- No new components or widgets
- No Android changes
- StatusStrip and QuickActionsGrid files remain on disk (just not imported)

## Done Criteria

1. Each data point appears exactly once on screen
2. No pie charts, no competing progress bars
3. Header is one compact block (name + status + battery + sync)
4. Screen time section is one card (not two)
5. QuickActionsGrid removed from render
6. StatusStrip removed from render
7. All Hebrew, all RTL
8. Page feels like a control center, not an analytics dashboard

