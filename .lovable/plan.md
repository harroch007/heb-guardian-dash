## New Parallel Alerts / Smart Protection Screen — `AlertsV2`

### Overview

Create a new `/alerts-v2` route with a redesigned Alerts screen using the `homev2-light` theme. The live `/alerts` remains untouched. All data queries should stay based on the existing live Alerts page logic — no new backend logic.

### Architecture

The new page should reuse only real connected query logic already used by `src/pages/Alerts.tsx`:

- `alerts` table with child join
- `settings` only if actually needed by the existing alerts flow
- `alert_feedback` only if already used in the live screen
- real state fields such as `acknowledged_at`, `saved_at`, `remind_at`, verdict/severity, and positive/safe states only if they already exist in the current data model

Existing alert components (`AlertCardStack`, `AlertTabs`, `PositiveAlertCard`, `EmptyAlertsState`, `EmptySavedState`, `EmptyPositiveState`) may be reused **only if they render correctly inside the light theme wrapper without modifying the live components**.  
If any reused component still carries broken dark styling or live-screen assumptions, create V2-only wrappers / light variants instead of editing the live alerts UI.

### New file: `src/pages/AlertsV2.tsx`

Single page component with `homev2-light` class wrapper.

**Layout (light premium, RTL, mobile-first):**

1. **Header** — Title "הגנה חכמה", subtitle "ניטור AI והתראות", back button to `/home-v2`, refresh button, optional child filter dropdown only if already real and connected
2. **Summary section** — stat cards using only real connected values:
  - Open alerts count
  - Saved alerts count only if this is a real existing state in the current alerts logic
  - Positive alerts count only if real
  - Premium status only if it is already derived reliably in the current app
3. **Tabs / filters** — reuse `AlertTabs` only if all shown tabs are backed by real connected data already used in the live screen  
Use only real states such as:
  - new / open
  - positive
  - saved  
  Do **not** invent extra filters
4. **Alert content** — reuse `AlertCardStack` for standard alerts, `PositiveAlertCard` for positive alerts, and existing empty states for each real tab/state
5. **Smart Protection status block** — small lower-priority card at bottom:
  - premium/free status only if real
  - monitoring active/inactive only if there is a real connected source for this state
  - total alerts count

### Modified file: `src/App.tsx`

Add one route + import:

```tsx
import AlertsV2 from "./pages/AlertsV2";
// ...
<Route path="/alerts-v2" element={<ProtectedRoute><AlertsV2 /></ProtectedRoute>} />

```

### Real data used


| Data                     | Source                                                                    | Type             |
| ------------------------ | ------------------------------------------------------------------------- | ---------------- |
| Alerts                   | `alerts` table                                                            | Real             |
| Child names              | real child relation / join already used in live screen                    | Real             |
| Alert thresholds         | only if already truly used by the live alerts logic                       | Real if verified |
| Acknowledge/save actions | existing real alerts update flow                                          | Real             |
| Feedback                 | `alert_feedback` table only if already connected in live screen           | Real if verified |
| Children list (filter)   | `children` table                                                          | Real             |
| Premium status           | existing real subscription source only if already reliable in current app | Real if verified |


### Items omitted (not truly connected)


| Item                                           | Reason                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Messages scanned today                         | Do not include unless already reliably connected for this screen                                   |
| Monitoring metrics detail                      | No verified granular monitoring metrics beyond current real alert data                             |
| "Navigate to related context"                  | No verified alert detail/context page                                                              |
| Any invented recommendations / moderation copy | Not part of current connected data                                                                 |
| Monitoring active/inactive                     | Omit if this is only an assumption based on subscription and not a real connected monitoring state |


### Files changed


| File                         | Change                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `src/pages/AlertsV2.tsx`     | New file                                                               |
| `src/App.tsx`                | Add route + import                                                     |
| `src/components/alerts-v2/*` | Only if needed for V2-only light-theme wrappers / safe reused sections |


### Design

- Light premium theme via `.homev2-light` class
- Hebrew RTL, mobile-first
- Standalone (no `DashboardLayout`), back button to `/home-v2`
- Reuse existing alert components only if this does **not** require changing the live `/alerts` screen
- If reused components do not visually match the new branding, create V2-only wrappers / light versions
- Smart Protection block stays visually secondary
- No fake data
- No invented categories
- No placeholder text
- No dark-theme leftovers