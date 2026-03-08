
# Kippy Control — Phase A Status

## Completed ✅

### Data Model Migration
- `installed_apps` table — full device app inventory with RLS
- `schedule_windows` table — school/bedtime/shabbat schedules with RLS + CRUD policies
- `shabbat_zmanim` table — date-based (YYYY-MM-DD) candle lighting / havdalah lookup
- `report_installed_apps` RPC — SECURITY DEFINER, device bulk upserts
- `get_device_settings` RPC — extended to include `schedule_windows` array + `next_shabbat` object

## Next Steps (Phase B)
- Populate `shabbat_zmanim` with 24 months of data
- Refactor ChildDashboard into 4-tab layout (סקירה / אפליקציות / זמן מסך / מכשיר)
- Move existing components to their respective tabs

## Phase C (after B)
- Apps tab: installed_apps inventory UI
- Screen Time tab: schedule windows CRUD UI + Shabbat toggle
- Device tab: polished health view

## Key Decisions
- `havdalah` = policy-defined exit time from device block, not a halachic statement
- Schedule windows are total blocks (no `allowed_apps` in MVP)
- Bonus time = Phase 2 only, no workaround
- Installed apps = user-installed + has launcher icon only
- Shabbat times = Israel-based (Asia/Jerusalem), date-keyed, no GPS dependency
