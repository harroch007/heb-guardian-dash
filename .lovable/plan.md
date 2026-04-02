## Enhanced Ring Device Status Feedback — V2 Screens

### Step 1 — Current Flow Mapping

**Ring button locations (V2 only):**

1. `ChildCardV2.tsx` (HomeV2) — simple insert, fire-and-forget, no polling
2. `ChildControlV2.tsx` — insert + polling via `useCommandPolling`, status reflected in quick action button + `LocationSection`
3. `FamilyV2.tsx` — simple insert, fire-and-forget, no polling

**Current data path:**

- Parent clicks ring → inserts row into `device_commands` with `command_type: 'RING_DEVICE'`, `status: 'PENDING'`
- Android agent picks it up → updates status to `ACKNOWLEDGED` → plays sound → updates to `COMPLETED`
- `result` column exists (text, nullable) but is always NULL for ring commands today
- Available statuses in production: `PENDING`, `ACKNOWLEDGED`, `COMPLETED`, `EXPIRED`
- Do **not** introduce a new DB status unless you first prove it already exists in the current schema and is already supported safely end-to-end

**Existing realtime in V2:**

- `ChildControlV2` has a realtime subscription on `devices` table for the child's device
- `ChildControlV2` uses polling (5s interval, 2min timeout) on `device_commands` for command status
- `ChildCardV2` and `FamilyV2` have no command polling — just fire-and-forget

**What's missing today:**

- No distinction between "device received command" (ACKNOWLEDGED), "ringing now", "child stopped it", or "ring timed out naturally"
- The `result` field is never populated by the Android agent for ring commands
- `ChildCardV2` (HomeV2) shows no progress feedback after sending

### Step 2 — Approach (Path A — extend existing)

Use the existing `device_commands.result` text field to carry richer ring outcome. No schema changes needed — `result` is already a nullable text column.

**Convention for the** `result` **field on RING_DEVICE commands:**

- `null` — no detail (backward compatible)
- `"RING_STARTED"` — device began playing sound (set alongside `ACKNOWLEDGED` if Android can safely do it)
- `"CHILD_STOPPED"` — child manually stopped the ring
- `"RING_TIMEOUT"` — ring played for the full device-defined duration and stopped naturally
- `"RING_FAILED"` — device could not play sound or the ring flow failed after pickup

The Android agent already updates `status` to `COMPLETED` — it just needs to also set `result` to one of the above. This is an additive contract extension; old agents that don't set `result` still work fine (`result` stays `null`, dashboard falls back to current behavior).

No new tables, no new columns, no new realtime channels.  
Do **not** hardcode ring duration in the dashboard logic. The dashboard must react only to the existing command row `status` + `result`, while Android remains the source of truth for whether the ring ended because of child stop, timeout, or failure.

### Step 3 — Dashboard Changes (V2 only)

**3a.** `ChildControlV2.tsx` **— Enhanced polling interpretation**

The existing `useCommandPolling` already reads `status`. Extend it to also read `result` from the same query. Map to richer UI states.

Hard requirements:

- Poll and interpret only the exact inserted `command_id` for the current ring action
- Do **not** infer state from “latest command for this child” once a specific `command_id` exists
- Do **not** widen this logic to non-ring commands
- Keep the current polling pattern narrow and additive

```
type RingPhase = "idle" | "sending" | "ringing" | "child_stopped" | "timeout" | "failed" | "completed_legacy";

```

State mapping:


| DB status           | DB result            | UI phase         |
| ------------------- | -------------------- | ---------------- |
| PENDING             | *                    | sending          |
| ACKNOWLEDGED        | null or RING_STARTED | ringing          |
| COMPLETED           | CHILD_STOPPED        | child_stopped    |
| COMPLETED           | RING_TIMEOUT         | timeout          |
| COMPLETED           | RING_FAILED          | failed           |
| COMPLETED           | null                 | completed_legacy |
| EXPIRED             | *                    | failed           |
| poll timeout (2min) | —                    | failed           |


Quick action button label changes:

- idle: "צלצל"
- sending: "שולח..." (spinner)
- ringing: "מצלצל..." (animated speaker icon)
- child_stopped: "הילד עצר ✓" (green, auto-reset 5s)
- timeout: "הצלצול הסתיים ✓" (green, auto-reset 5s)
- completed_legacy: "הצלצול הושלם ✓" (green, auto-reset 5s)
- failed: "נכשל" (red, clickable to retry)

Toast messages updated accordingly, but keep them minimal and do not create duplicate toast spam for the same terminal state.

**3b.** `LocationSection.tsx` **— Same ring status enhancement**

Already receives `ringStatus` as prop. Extend the prop type to include the new phases. Update `getRingButtonContent()` with the richer labels.

**3c.** `ChildCardV2.tsx` **(HomeV2) — Add lightweight polling**

Currently fire-and-forget. Add:

- Track the inserted `command_id`
- Poll every 5s for up to 2min (same pattern as `ChildControlV2`)
- Show inline status on the ring `ActionBtn`: spinner → ringing → result
- Use a small text label or icon swap (no modal, no new UI element)
- Poll only the exact command row that was just inserted
- Avoid stale state if the component rerenders or multiple child cards exist on screen

**3d.** `FamilyV2.tsx` **— Add lightweight polling**

Same as `ChildCardV2`:

- Track the inserted `command_id`
- Poll every 5s for up to 2min
- Show inline feedback on the ring button
- Poll only that exact command row
- Keep the UI lightweight and additive

### Files changed

1. `src/pages/ChildControlV2.tsx` — extend polling to read `result`, richer ring UI states
2. `src/components/child-dashboard/LocationSection.tsx` — update ring button labels for new phases
3. `src/components/home-v2/ChildCardV2.tsx` — add command polling for ring feedback
4. `src/pages/FamilyV2.tsx` — add command polling for ring feedback
5. Optional only if truly needed: one tiny V2-local helper/hook for ring status interpretation; do **not** refactor broader command architecture

### What this does NOT change

- Live app screens (`ChildDashboard.tsx`, etc.) — untouched
- No new Supabase tables or columns
- No new realtime subscriptions (uses existing polling pattern)
- No new navigation or modals
- No schema migration
- No new command transport
- Android agent contract is additive only — old agents still work