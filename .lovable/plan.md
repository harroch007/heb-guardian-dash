## V2 Shared Navigation Shell

### What exists today

Each V2 screen (`HomeV2`, `ChildControlV2`, `ChoresV2`, `AlertsV2`, `SettingsV2`, `FamilyV2`) is standalone with individual back buttons to `/home-v2`. There is no shared bottom navigation or app shell connecting them. The live app uses `DashboardLayout` + `BottomNavigation` + `AppSidebar` — all pointing to live routes.

### What to build

**One new component**: `src/components/BottomNavigationV2.tsx` — a light-themed bottom tab bar for mobile, connecting only V2 tab routes.

**Tabs** (5 items only):


| Tab      | Label  | Route          | Icon          |
| -------- | ------ | -------------- | ------------- |
| Home     | בית    | `/home-v2`     | Home          |
| Family   | משפחה  | `/family-v2`   | Users         |
| Tasks    | משימות | `/chores-v2`   | ClipboardList |
| Alerts   | התראות | `/alerts-v2`   | Bell          |
| Settings | הגדרות | `/settings-v2` | Settings      |


**Design**: Light premium styling using `homev2-light` tokens — white background, turquoise active indicator, gray inactive icons. No alert badge. Fixed bottom, mobile only (`md:hidden`).

**Integration**: Add `<BottomNavigationV2 />` to the V2 tab pages:

- `HomeV2`
- `FamilyV2`
- `ChoresV2`
- `AlertsV2`
- `SettingsV2`

`ChildControlV2` is a **detail screen**, not a tab destination.  
It should **keep its back button** and should **not** appear as an active bottom-nav destination.  
Only add `<BottomNavigationV2 />` there if it behaves as passive shell navigation and does not create confusing active-tab behavior. If that is visually/UX confusing, leave `ChildControlV2` with back button only.

### Files changed


| File                                    | Change                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/components/BottomNavigationV2.tsx` | New file — light-themed bottom tab bar for V2 routes                                                          |
| `src/pages/HomeV2.tsx`                  | Add `<BottomNavigationV2 />`, adjust bottom spacing if needed                                                 |
| `src/pages/FamilyV2.tsx`                | Add `<BottomNavigationV2 />`                                                                                  |
| `src/pages/ChoresV2.tsx`                | Add `<BottomNavigationV2 />`, remove standalone back button                                                   |
| `src/pages/AlertsV2.tsx`                | Add `<BottomNavigationV2 />`, remove standalone back button                                                   |
| `src/pages/SettingsV2.tsx`              | Add `<BottomNavigationV2 />`, remove standalone back button                                                   |
| `src/pages/ChildControlV2.tsx`          | Add `<BottomNavigationV2 />` only if it does not create broken active-state UX; keep back button in all cases |


### What is NOT changed

- No live files modified (`BottomNavigation.tsx`, `AppSidebar.tsx`, `DashboardLayout.tsx`)
- No new routes added
- No fake badges or counters
- No new features
- No desktop sidebar for V2 (mobile-first only for now)
- No forced active-tab treatment for `ChildControlV2`

### V2 routes connected

Tab-connected routes:

- `/home-v2`
- `/family-v2`
- `/chores-v2`
- `/alerts-v2`
- `/settings-v2`

Detail route:

- `/child-v2/:childId` via back behavior and optional passive shell navigation only

### V2 routes omitted

None, but `ChildControlV2` should be treated as a detail screen, not as a primary tab destination.