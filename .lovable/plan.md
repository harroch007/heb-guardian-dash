

# Diagnosis: Why Ring & Locate Are Failing

## Root Cause — Confirmed

The **Dashboard is working correctly**. All commands (RING_DEVICE, LOCATE_NOW, etc.) are being inserted into `device_commands` successfully. The database configuration is also correct:

- RLS policies for `anon` SELECT/UPDATE on `device_commands` — **exist** ✅
- Table-level GRANT for `anon` SELECT/UPDATE on `device_commands` — **exist** ✅
- `device_commands` in Realtime publication — **yes** ✅
- Device row exists with `child_id IS NOT NULL` — **yes** ✅
- Device is online (`last_seen` = 2 minutes ago, battery = 100%) — **yes** ✅

**The problem: 13+ commands are stuck at `PENDING`. The Android app is NOT reading them.**

The dashboard polls for 2 minutes, the command never moves from PENDING, and the dashboard correctly shows "failed / device not connected."

## Evidence

```text
RING_DEVICE    14:54:34   PENDING (never picked up)
RING_DEVICE    14:54:50   PENDING (never picked up)  
REPORT_HEARTBEAT 14:55:23 PENDING (never picked up)
REFRESH_SETTINGS 14:55:50 PENDING (never picked up)
```

Meanwhile the device is actively sending heartbeats and battery — confirming it IS connected to Supabase, but it's not reading `device_commands`.

## What This Means

There is nothing to fix on the Dashboard or Supabase side. The issue is strictly that the Android app is not:
1. Subscribing to Realtime on `device_commands`, OR
2. Polling `device_commands` with `SELECT ... WHERE device_id = '...' AND status = 'PENDING'`

## Exact Prompt for Android Developer

Give them this:

> **Critical Bug: Your device is NOT consuming commands from `device_commands`.**
>
> **Evidence:** 13+ commands (RING_DEVICE, LOCATE_NOW, REFRESH_SETTINGS, REPORT_HEARTBEAT) are stuck at PENDING since 14:24. Your device `9d5a9132b033a86b` has `last_seen` updated 2 minutes ago, battery at 100%, heartbeats flowing — proving your Supabase connection works. But you are NOT reading `device_commands`.
>
> **What you need to do:**
> 1. Run this query from your app (using anon key): `supabase.from("device_commands").select("*").eq("device_id", "9d5a9132b033a86b").eq("status", "PENDING")` — verify you get rows back. If not, your RLS/auth context is wrong.
> 2. If the query works, your Realtime subscription or polling loop has a bug — it's not triggering the handler.
> 3. Add a polling fallback: every 30 seconds, SELECT PENDING commands and process them.
>
> **RLS is confirmed working for anon:** The policy `"Devices can read commands (legacy fallback)"` allows any anon caller to SELECT commands for device_ids that are paired with a child. Your device IS paired.

## Dashboard-Side Action (optional cleanup)

I can add a small improvement: clean up stale PENDING commands older than 5 minutes so they don't accumulate. This is cosmetic — the real fix must be on Android.

