## New Parallel Tasks & Rewards Screen — `ChoresV2`

### Overview

Create `/chores-v2` route with a redesigned Tasks & Rewards screen using the `homev2-light` theme. The live `/chores` remains untouched.

### Architecture

Reuse existing real connected logic only:

- `useChores` hook
- `children`
- `chores`
- `reward_bank`
- `reward_transactions`
- `bonus_time_grants` only if already truly connected and reliable in the current project

Existing functional components (`ChoreForm`, `ChoreList`, `RewardBankCard`) may be reused **only if they render correctly inside the light theme wrapper without modifying the live components**.  
If any of them carry broken dark styling or live-screen assumptions, create parallel wrapped/light versions for `ChoresV2` only.

All data must remain real and connected.  
Do **not** add any new product logic.

### New file: `src/pages/ChoresV2.tsx`

Single page component that:

- Fetches children from `children` table (same pattern as live Chores page)
- Uses `useChores(selectedChildId)` for real task/reward data
- Wraps everything in `homev2-light` scoped theme

**Layout (light premium, RTL, mobile-first):**

1. **Header** — Title "משימות ותגמולים", subtitle "מערכת חיובית לניהול זמן מסך", back button to `/home-v2`
2. **Child filter** — Select dropdown only when multiple children exist and only if already real and connected
3. **Summary section** — stat cards using only real connected metrics:
  - Active tasks count
  - Completed tasks count
  - Reward bank balance
  - Today's bonus granted **only if this value is already truly reliable and connected in the current project**
4. **Reward bank card** — reuse `RewardBankCard` only if safe in light theme (shows balance + recent transactions from `reward_transactions`)
5. **Add task form** — reuse `ChoreForm` only if safe in light theme
6. **Active tasks list** — reuse `ChoreList` only if safe in light theme (shows only real status, approval buttons, photo proof if real, reward minutes)
7. **Completed tasks section** — include only if already clearly supported by real connected data in current list/query logic
8. **Quick actions** — keep minimal and only real:
  - "צור משימה" (scrolls to form)
  - "פתח את ניהול הילד" (navigates to `/child-v2/:childId`) only when a child is selected clearly

### Modified file: `src/App.tsx`

Add one route:

```
<Route path="/chores-v2" element={<ProtectedRoute><ChoresV2 /></ProtectedRoute>} />
```

### Real data used


| Data                        | Source                                                                  | Type                                          |
| --------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| Children list               | `children` table                                                        | Real                                          |
| Chores (real statuses only) | `chores` table                                                          | Real                                          |
| Reward bank balance         | `reward_bank` table                                                     | Real                                          |
| Reward transactions         | `reward_transactions` table                                             | Real                                          |
| Bonus grants today          | `bonus_time_grants` table                                               | Real only if verified in current project flow |
| Task approval/reject        | existing real RPCs / mutations only if already connected in current app | Real                                          |
| Task creation               | existing real create flow                                               | Real                                          |
| Task deletion               | existing real delete flow                                               | Real                                          |


### Items omitted (not truly connected)


| Item                                                       | Reason                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| Due dates                                                  | No verified `due_date` support in current task flow     |
| Task templates                                             | No template table exists                                |
| Gamification elements                                      | None exist                                              |
| Earned minutes summary/aggregation                         | No verified aggregation beyond current reward/bank data |
| Any fake “progress” metrics                                | Not real                                                |
| Child-independent quick actions that require child context | Misleading UX if no child selected                      |


### Files changed


| File                         | Change                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| `src/pages/ChoresV2.tsx`     | New file                                                          |
| `src/App.tsx`                | Add one route                                                     |
| `src/components/chores-v2/*` | Only if needed for light-theme wrappers / V2-safe reused sections |


### Design

-   
Light premium theme via `.homev2-light` class  

-   
Hebrew RTL, mobile-first  

-   
Standalone (no `DashboardLayout`), back button to `/home-v2`  

-   
Reuse existing components only if this does **not** require changing the live `/chores` screen  

-   
If reused components do not visually match the new branding, create V2-only wrappers / light versions  

-   
Keep the screen positive, clear, and operational  

-   
No fake sections  

-   
No invented metrics  

-   
No dark-theme leftovers  

-   
Keep visual language consistent with `HomeV2` and `ChildControlV2`  
