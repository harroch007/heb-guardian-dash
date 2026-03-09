

## Analysis: Schedules System - Bugs Found

### Root Cause
The `schedule_windows` table has a CHECK constraint that only allows these values:
```
'daily_recurring', 'weekly_recurring', 'shabbat'
```

But the UI code (in `ScheduleEditModal` and `SchedulesSection`) sends `'bedtime'` and `'school'` as `schedule_type` values. This is why saving fails with a 400 error - the DB rejects the insert.

The network request confirms this:
```
POST schedule_windows → 400
"new row violates check constraint schedule_windows_schedule_type_check"
```

### Fix Plan

**1. Update DB check constraint** (migration)
- Drop the existing constraint and replace it with one that allows: `'daily_recurring'`, `'weekly_recurring'`, `'shabbat'`, `'bedtime'`, `'school'`

**2. Verify `get_device_settings` RPC**
- Already confirmed: the RPC sends all active `schedule_windows` to the Android device regardless of `schedule_type` value. So once the constraint is fixed, bedtime and school schedules will be included automatically in the device sync.

**3. Verify Shabbat schedule**
- Shabbat already works (the existing row in DB has `schedule_type: 'shabbat'` and toggles correctly). Its times come from `shabbat_zmanim` lookup or manual mode - both are wired up.

### Summary
This is a single migration fix. The UI code, hook logic, and `get_device_settings` RPC are all correct. The only blocker is the DB check constraint rejecting `'bedtime'` and `'school'` values.

