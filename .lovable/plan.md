## New Parallel Family Management Screen — `FamilyV2`

### Overview

Create a new page at `/family-v2` with a redesigned Family/Children Management screen using the `homev2-light` theme. The live `/family` remains untouched.

### Architecture

Reuse the same real connected data pattern already used in `HomeV2` for enriched child cards, plus the existing `AddChildModal` only if it can be reused safely without affecting the live screen.

Do **not** add new backend logic.  
Do **not** invent extra family-management flows.

Use only real connected data already available from:

- `children`
- `devices`
- `alerts`
- `reward_bank`
- `children.subscription_tier`
- existing real actions such as ring device / add bonus time only if already safely connected in the current app

If any reused family/add-child component is too tightly coupled to the current live styling, create a V2-only wrapper instead of editing the live component.

### New file: `src/pages/FamilyV2.tsx`

Single page with `homev2-light` wrapper, standalone (no `DashboardLayout`), back button to `/home-v2`.

**Layout (light premium, RTL, mobile-first):**

1. **Header** — "המשפחה שלי", subtitle "ניהול ילדים, מכשירים והרשאות"
2. **Family summary** — summary cards using only real connected data:
  - Total children count
  - Connected devices count only if derived reliably from real `devices.last_seen`
  - Open alerts count
  - Premium children count only if real
3. **Children list** — For each child, a card showing only real connected fields:
  - Name
  - Connection status
  - Battery level
  - Last seen time
  - Reward bank balance
  - Open alerts count
  - Premium/free badge only if real
  - **Primary CTA**: "נהל ילד" → navigates to `/child-v2/:childId`
  **Secondary actions** only if already real and safely connected:
  - Ring device
  - Add time
4. **Add child CTA** — Button that opens existing `AddChildModal` only if this existing flow can be reused safely in V2 without changing the live experience
5. **Family subscription summary** — small lower-priority card:
  - Premium/free children breakdown
  - "שדרג עכשיו" only if there is already a real connected upgrade flow and only when relevant

### Data sources (all real only)


| Data                          | Source                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| Children                      | `children` table                                                 |
| Devices + battery + last_seen | `devices` table                                                  |
| Alerts (open/unacknowledged)  | `alerts` table                                                   |
| Reward bank                   | `reward_bank` table                                              |
| Subscription tier             | `children.subscription_tier`                                     |
| Ring device                   | existing real `device_commands` flow only if already connected   |
| Add bonus time                | existing real `bonus_time_grants` flow only if already connected |
| Add child                     | existing `AddChildModal` only if safe to reuse                   |


### Items omitted


| Item                    | Reason                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Child avatar/photo      | No real avatar storage exists                                         |
| Gender-based icon/color | Do not invent visual identity based on gender                         |
| Location per child      | Keep for child control center, not family list                        |
| Screen time summary     | Keep for child control center / HomeV2, not family list               |
| Device health summary   | Too heavy for list view; keep for child control center                |
| Invite/setup flow       | No separate verified invite/setup flow beyond existing add-child flow |
| Any fake child state    | Not allowed                                                           |


### Files changed


| File                         | Change                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `src/pages/FamilyV2.tsx`     | New file                                                                                   |
| `src/App.tsx`                | Add `/family-v2` route + import                                                            |
| `src/components/family-v2/*` | Only if needed for V2-only wrappers / light-theme child cards / safe AddChildModal wrapper |


### Design

- Light premium theme via `.homev2-light` class
- Hebrew RTL, mobile-first
- Standalone (no `DashboardLayout`), back button to `/home-v2`
- Control-first: each child card has a clear CTA to manage
- Consistent with `HomeV2` / `ChildControlV2` / `ChoresV2` / `AlertsV2` / `SettingsV2`
- No fake data
- No invented states
- No gender-based visual assumptions
- No dark-theme leftovers