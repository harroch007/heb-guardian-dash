## New Parallel Home Screen — `HomeV2`

### Overview

Create a new `/home-v2` route with a multi-child, control-first Home screen that uses only real Supabase data. The current `/dashboard` route and all its components remain untouched.

### Technical Approach

**New files only** — no modifications to existing files except adding one route in `App.tsx`.

**Important adjustments:**

- Do **not** use dark theme. The new parallel screen must follow the approved new branding direction: **light premium UI**, Hebrew RTL, mobile-first.
- Do **not** invent or over-compute product states that are not truly reliable.
- If a value cannot be derived with confidence from real connected data, omit it and report it.

### Files to Create

#### 1. `src/pages/HomeV2.tsx` — Main page component

Fetches all children for the current parent, then for each child fetches only real connected data needed for the approved Home structure.

Use existing connected sources only:

- children
- parent_home_snapshot
- devices
- alerts
- reward_bank
- schedule_windows
- time_extension_requests
- chores
- settings
- get_child_device_health RPC

Do **not** introduce new backend logic or speculative aggregations if current connected queries already provide the needed value.

#### 2. `src/components/home-v2/HomeGreeting.tsx` — Personal header

- Parent greeting (time-based, same logic as `DashboardGreeting`)
- Parent name from `parents` table
- Short status line based only on real verifiable high-level state

Approved short status line examples:

- "{N} ילדים מחוברים"
- "הכול תקין כרגע"
- "יש נושאים שדורשים תשומת לב"

Do **not** generate marketing copy or extra explanatory text.

#### 3. `src/components/home-v2/FamilyStatusHero.tsx` — Family status hero

Use only simple, reliable, real summary items:

- Connected children count
- Protection / device health status summary
- Open issues count
- Active restrictions now **only if this can be derived reliably from real schedule data and current day/time logic already used in the app**

Data sources:

- `children`
- `devices`
- `schedule_windows`
- `alerts`
- `time_extension_requests`
- `get_child_device_health` RPC

**Adjustment:**  
Do **not** represent “Protection active” as a misleading boolean based only on whether any schedule window is active right now.  
Instead, use a safer summary tied to real health/connection/protection signals already available in the current system.

#### 4. `src/components/home-v2/ChildCardV2.tsx` — Per-child card

Real connected fields only:

- Child name (from `children`)
- Connection status + battery + last seen (from `devices`)
- Last location address if available from real connected source
- Screen time used today
- Remaining screen time today **only if daily limit is truly connected per child**
- Current restriction / normal mode **only if it can be computed reliably from existing schedule logic**
- Bonus bank balance
- One short status line summarizing the above

Primary CTA:

- "ניהול הילד" → navigates to `/child/:childId`

Secondary actions:  
Only include actions that are already real and connected **and already exist safely in the current product flow**:

- Ring device
- Add time
- Location
- Alerts

**Adjustments:**

- If address is not directly reliable from a real connected source for all children, prefer a simpler location state instead of forcing address display.
- Do **not** expose remaining screen time if the per-child limit is not reliably connected.
- Do **not** expose “current restriction” if this would be a weak guess.

#### 5. `src/components/home-v2/AttentionSection.tsx` — Attention needed

Queries only real action-required items:

- Unacknowledged AI alerts
- Permission / protection issues from `get_child_device_health`
- Device disconnected / stale last seen
- Pending time requests
- Pending app requests **only if there is a real reliable source for this state**

Each item links to the relevant page.

**Adjustment:**  
Keep this section strict and small.  
Do **not** include informational items that do not actually require parent action.

#### 6. `src/components/home-v2/QuickActionsBar.tsx` — Quick actions

Only actions that are already real and connected:

- Add child
- Create task
- Add bonus time
- Ring device
- Manage apps

**Adjustment:**  
Do **not** add a generic quick action that depends on selecting a child unless the UX is already solved clearly.  
If an action is child-specific, handle it from the child card, not as a misleading global quick action.

#### 7. `src/components/home-v2/DailyControlSummary.tsx` — Daily control summary

Real connected metrics only:

- Total screen time today
- Pending time requests count
- Bonus minutes granted today
- Tasks completed today
- Active restrictions count **only if reliably computed**

Data sources:

- `parent_home_snapshot`
- `time_extension_requests`
- `bonus_time_grants`
- `chores`
- `schedule_windows`

**Adjustment:**  
This block should stay operational and light.  
Do **not** turn it into a WhatsApp/AI analytics card.

#### 8. `src/components/home-v2/SmartProtectionSummary.tsx` — Smart protection (lower priority)

Lower-priority premium block only:

- Premium status
- WhatsApp monitoring active/inactive **only if backed by real connected logic**
- New alerts count today
- Messages scanned today **only if already real and connected**

**Adjustment:**  
This section must remain visually secondary to parental control.  
Do **not** make it the visual hero of the page.

### File to Modify

#### `src/App.tsx` — Add one route

```
import HomeV2 from "./pages/HomeV2";
// ...
<Route path="/home-v2" element={<ProtectedRoute><HomeV2 /></ProtectedRoute>} />
```

Added alongside existing routes. `/dashboard` remains the live home.

### Items That Will Be Omitted (Not Truly Connected)


| Item                                  | Reason                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| Avatar/photo                          | No avatar storage exists for children                                                   |
| Remaining screen time per child       | Only include if daily per-child limit is truly connected and reliable                   |
| Current restriction / normal mode     | Only include if can be derived reliably from real existing schedule logic               |
| Restriction issue attention item      | No specific restriction-issue detection exists                                          |
| Global open location quick action     | Location is child-specific, better handled inside child card                            |
| Pending app requests                  | Only include if there is a real reliable connected source for this state                |
| Exact address display for every child | Only include if address is truly available from a real connected source, otherwise omit |


### Data Source Summary


| Data Point                     | Source                                                                                  | Type             |
| ------------------------------ | --------------------------------------------------------------------------------------- | ---------------- |
| Parent name                    | `parents` table                                                                         | Real             |
| Children list                  | `children` table                                                                        | Real             |
| Device status/battery/location | `devices` table                                                                         | Real             |
| Address                        | `parent_home_snapshot` view only if verified available and reliable                     | Real if verified |
| Screen time today              | `parent_home_snapshot.total_usage_minutes`                                              | Real             |
| Screen time limit              | `settings.daily_screen_time_limit_minutes` only if truly connected per child in UI flow | Real if verified |
| Bonus bank                     | `reward_bank.balance_minutes`                                                           | Real             |
| Today's bonus                  | `bonus_time_grants`                                                                     | Real             |
| Schedule windows               | `schedule_windows`                                                                      | Real             |
| Alerts                         | `alerts` table                                                                          | Real             |
| Time requests                  | `time_extension_requests`                                                               | Real             |
| Chores                         | `chores` table                                                                          | Real             |
| Premium status                 | `children.subscription_tier`                                                            | Real             |
| Messages scanned               | `parent_home_snapshot.messages_scanned`                                                 | Real             |
| Device health                  | `get_child_device_health` RPC                                                           | Real             |
| Ring device                    | `device_commands` INSERT                                                                | Real             |


### Design

-   
Hebrew RTL  

- **Light premium theme**  

-   
Mobile-first  

-   
New parallel branding direction only for `HomeV2`  

-   
Keep current live Kippy experience untouched  

-   
Can reuse existing layout/navigation shell if needed, but the new screen itself should reflect the approved redesign direction  

-   
No fake sections  

-   
No invented metrics  

-   
No WhatsApp-centric hero  

-   
No framer-motion animations beyond what exists  
