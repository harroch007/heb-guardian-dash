## New Parallel Child Control Center — `ChildControlV2`

### Overview

Create a new `/child-v2/:childId` route with a redesigned Child Control Center using only real Supabase data. The live `/child/:childId` remains untouched. Uses the same `homev2-light` scoped theme as HomeV2.

### Architecture

The new page reuses the existing `useChildControls` hook (which already fetches app policies, schedules, device health, bonus minutes, etc.) plus direct Supabase queries for device, settings, alerts, chores, reward bank, and time requests — same pattern as the live ChildDashboard.

Existing child-dashboard components (`AppsSection`, `ScreenTimeSection`, `SchedulesSection`, `LocationSection`, `TimeRequestsCard`, `ProblemBanner`) may be reused **only if they render correctly inside the light theme wrapper without modifying the live components**.  
If any of them are too tightly coupled to the current live styling, create parallel wrapped copies for `ChildControlV2` instead of editing the live components.

### Day mapping fix

Do **not** change `ChildCardV2.tsx` in this task.

If active schedule / current restriction is shown in `ChildControlV2`, use a **local helper inside the new screen** with the correct 1–7 mapping for `schedule_windows`:  
`const dayOfWeek = now.getDay() + 1`

Only show active restriction if this can be derived reliably from real existing schedule data and current time logic.

### New files

**1.** `src/pages/ChildControlV2.tsx` — Main page

Fetches:

- `children` (name, gender)
- `devices` (battery, lat/lon, address, last_seen) + real-time subscription
- `settings` (daily_screen_time_limit_minutes) only if truly connected per child
- `reward_bank` (balance_minutes)
- `alerts` (unacknowledged count, today count)
- `chores` (active/completed counts)
- `time_extension_requests` (pending count)
- `get_child_device_health` RPC (permissions)

Uses `useChildControls(childId)` for app policies, schedules, blocked attempts, installed apps, bonus minutes, and all mutation functions.

Do **not** depend on `parent_home_snapshot` unless the data is clearly child-scoped and already verified as reliable for this screen. If not, omit it.

Layout (single scroll, light theme, RTL):

1. **Child Header** — name, connection badge, battery, last sync
2. **Current Status Hero** — screen time used/limit, bonus bank balance, active restriction name only if reliable, short status line
3. **Quick Actions Row** — ring device, add bonus time, locate, manage apps (scroll anchors), create task only if existing route/action is already real and connected
4. **Time Requests** — reuses existing `TimeRequestsCard` if safe
5. **Problem/Sync Banners** — reuses `ProblemBanner` + `SyncNotice` only if already real and connected
6. **Screen Time** — reuses `ScreenTimeSection` if safe
7. **Schedules** — reuses `SchedulesSection` if safe
8. **Apps** — reuses `AppsSection` if safe
9. **Location & Device** — reuses `LocationSection` if safe
10. **Tasks & Bonus** — card showing active chores count, completed today count only if real, reward bank balance
11. **Smart Protection** — card showing premium status, monitoring active/inactive only if real, unacknowledged alerts count, link to `/alerts`
12. **Device Health** — card mapping `get_child_device_health` permissions to Hebrew labels, showing each permission status in human language

### Modified files

`src/App.tsx` — Add one route:

```
<Route path="/child-v2/:childId" element={<ProtectedRoute><ChildControlV2 /></ProtectedRoute>} />
```

### Items omitted (not truly connected)


| Item                                 | Reason                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------- |
| "Block now" quick action             | No instant-block-all feature exists                                         |
| "Temporary unlock" quick action      | No temporary unlock feature exists                                          |
| "Remaining screen time today"        | Only include if daily per-child limit is truly reliable in this screen      |
| "Next scheduled restriction"         | Would require future schedule computation; omit for now                     |
| "Bonus time used today" breakdown    | Only total bonus granted / balance is available, not consumed breakdown     |
| "Earned minutes summary"             | No verified earned-from-tasks aggregation beyond current reward/bank values |
| "Temporary approvals" in apps        | No temporary approval concept exists                                        |
| `parent_home_snapshot` child metrics | Omit unless clearly verified as child-scoped and reliable for this screen   |


### Real data sources

All data from verified existing sources only: `children`, `devices`, `settings`, `reward_bank`, `alerts`, `chores`, `time_extension_requests`, `app_policies`, `installed_apps`, `blocked_app_attempts`, `schedule_windows`, `device_commands`, `get_child_device_health` RPC.

Use only data that is already real and connected.  
  
If any queried value is not reliable in practice, omit it and report it.

### Design

-   
Light premium theme via `.homev2-light` class  

-   
Hebrew RTL, mobile-first  

-   
No `DashboardLayout` (same standalone pattern as HomeV2 — no dark sidebar)  

-   
Back button → `/home-v2`  

-   
Reuse existing child-dashboard components only if this does **not** require modifying the live screen or live styling  

-   
No fake sections  

-   
No invented metrics  

-   
No WhatsApp-centric hero  

-   
Smart Protection remains visually secondary to parental control  
