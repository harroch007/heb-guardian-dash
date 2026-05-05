## Plan: Split "All Tasks" into nested accordions (Open / Completed)

### Goal
On `/chores-v2`, replace the single "כל המשימות (9)" block with two collapsible sub-sections inside the existing accordion item, so the parent can choose what to view and the page is more compact.

### Changes

**1. `src/pages/ChoresV2.tsx`**
- Remove the count `({chores.length})` from the "כל המשימות" trigger label.
- Replace the flat `<ChoreList chores={chores} ... />` content with a nested `Accordion type="multiple"` containing two items:
  - **"משימות פתוחות (N)"** — N = active count (`pending` + `completed_by_child`).
  - **"הושלמו (N)"** — N = `approved` + `rejected`.
- Each nested item renders a filtered `ChoreList` (passing only its own subset).
- Default open: "משימות פתוחות" (open by default), "הושלמו" closed.
- If a sub-list is empty, still show the trigger (count = 0) but content shows the existing empty state.

**2. `src/components/chores/ChoreList.tsx`**
- Remove the internal "active vs done" split + the "הושלמו" sub-heading (lines 37–57), since splitting now happens at page level. Render a single flat list of the chores it receives.
- Keep photo dialog, item rendering, and empty state unchanged.

### Visual outcome
```
▾ כל המשימות
   ▾ משימות פתוחות (5)
       [chore items...]
   ▸ הושלמו (4)
```

### Out of scope
No changes to data fetching, RPCs, styling tokens, or other accordion items (Pending approval, Add task, Bank).