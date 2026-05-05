## Fix: 8–10s delay when deleting a chore

### Root cause
In `src/hooks/useChores.ts`, `deleteChore` awaits the DB delete and then `await sendRefreshToAllDevices()`, which does:
1. A `SELECT` on `devices` for this child.
2. A sequential `INSERT` into `device_commands` for **each** device (loop with `await`).

The UI only updates when the realtime `chores` channel fires, so the parent sees nothing until the whole chain (delete + N command inserts + realtime round-trip) completes — typically 8–10s on slower networks / many devices.

The same pattern affects `addChore`, `approveChore`, `rejectChore`.

### Plan
Edit `src/hooks/useChores.ts`:

1. **Optimistic delete** — in `deleteChore`, immediately remove the chore from local state, then call the DB delete. On error, roll back state and show toast.
2. **Fire-and-forget device refresh** — change `await sendRefreshToAllDevices()` to `void sendRefreshToAllDevices()` in `addChore`, `approveChore`, `rejectChore`, `deleteChore`. The realtime channel + 30s poll already keep things consistent; blocking the UI on it is unnecessary.
3. **Parallelize device inserts** inside `sendRefreshToAllDevices` — replace the `for…await` loop with `Promise.all(devices.map(...))` so multi-device families don't pay N× latency.

### Out of scope
No DB / RPC / RLS changes. No UI restructuring.