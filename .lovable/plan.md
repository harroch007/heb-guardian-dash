

## Problem

After disconnecting a child device from the parent dashboard, the Android app on the child's device remains open and running. There's no way to navigate back to the login/pairing screen on the child app to enter new pairing credentials. The current "Reconnect" flow (`ReconnectChildModal`) generates a new OTP code — but that code is useless because the child app isn't on the pairing screen.

## Root Cause

`disconnect_device` sets `devices.child_id = NULL` server-side, but the Android app has no mechanism to detect this state change and return to the pairing screen. Since we cannot modify the Android client, we need a server-side solution.

## Proposed Solution: "Quick Reconnect" (Undo Disconnect)

Add a **"חבר מחדש מכשיר קיים"** (Reconnect Existing Device) option that directly re-links the last known device to the child — no OTP, no child-app interaction needed.

### How it works

1. **New RPC `reconnect_device(p_child_id, p_device_id)`**:
   - Owner-only check (same as `disconnect_device`)
   - Verifies the device exists and currently has `child_id IS NULL` (i.e., it was previously disconnected)
   - Sets `devices.child_id` back to the given child
   - The Android app's next sync call (`get_device_settings`, heartbeat, etc.) will start working again immediately — no re-pairing needed

2. **Updated `ReconnectChildModal`**:
   - Before showing the OTP flow, query for disconnected devices that were previously linked to this child (by checking `devices` where `child_id IS NULL` and the device was recently seen)
   - If a recent disconnected device exists, show a **primary "Quick Reconnect"** button that calls the new RPC directly
   - Keep the existing OTP flow as a secondary option ("חיבור מכשיר חדש") for cases where a truly new device needs pairing

3. **No Android changes required** — the device keeps its existing session and resumes syncing once `child_id` is restored

### Files to change

| File | Change |
|---|---|
| New migration | `reconnect_device(p_child_id, p_device_id)` RPC with owner-only auth |
| `src/components/ReconnectChildModal.tsx` | Add quick-reconnect UI: fetch last device, show reconnect button, fallback to OTP |

### UX Flow

```text
Parent taps "חבר מכשיר" on disconnected child
  └─ Modal opens
     ├─ IF previous device found (last_seen recent):
     │    "המכשיר SM-G965F זוהה כמכשיר שהיה מחובר"
     │    [חבר מחדש]  ← one tap, done
     │    ─── או ───
     │    "חבר מכשיר חדש" → existing OTP flow
     └─ IF no previous device:
          Existing OTP flow (unchanged)
```

### Security

- RPC enforces `parent_id = auth.uid()` (owner-only, same pattern as `disconnect_device`)
- Only devices with `child_id IS NULL` can be reconnected (prevents hijacking active devices)
- Device identity (`device_id`) must be explicitly selected by the parent from known devices

