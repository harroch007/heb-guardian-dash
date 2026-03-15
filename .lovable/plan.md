
# Kippy Control — Phase A Status: ✅ COMPLETE

## Completed ✅

### Data Model Migration
- `installed_apps` table — full device app inventory with RLS
- `schedule_windows` table — school/bedtime/shabbat schedules with RLS + CRUD policies
- `shabbat_zmanim` table — date-based (YYYY-MM-DD) candle lighting / havdalah lookup
- `report_installed_apps` RPC — SECURITY DEFINER, device bulk upserts
- `get_device_settings` RPC — extended to include `schedule_windows` array + `next_shabbat` object

### Data Population
- `shabbat_zmanim` populated with 118 rows (2026-01-02 → 2028-03-31)
- Source: Hebcal API, Jerusalem, havdalah = sunset + 40 min (product policy)

## Completed (Phase B - Sync Fixes) ✅
- Dashboard auto-refresh every 60 seconds (polling `parent_home_snapshot`)
- SyncNotice filters commands older than 5 minutes (`device_commands` query)

## Chores & Rewards Feature ✅
- 3 tables: `chores`, `reward_bank`, `reward_transactions` with RLS + Realtime
- 3 RPCs: `approve_chore`, `reject_chore`, `redeem_reward_minutes`
- UI: `/chores` page with ChoreForm, ChoreList, RewardBankCard
- Navigation: "משימות" tab added to sidebar + bottom nav
- Android contract: SELECT/UPDATE chores, reward_bank; RPC redeem_reward_minutes; Realtime subscriptions

## Android-side fixes (for Android agent):
1. **Fix enforcement in AccessibilityService** — compare foreground app against blocked list
2. **Add Realtime subscription** for `device_commands` in ForegroundService
3. **Implement heartbeat reporting** — fill `sendDeviceHealthStatus` with `report_device_heartbeat` RPC
4. **Add periodic usage reporting** — call `upsert_app_usage` every 5-10 minutes on a timer
5. **Chores screen** — show pending chores, mark as completed, redeem bank minutes

## Next Steps (Phase B - UI)
- Refactor ChildDashboard into 4-tab layout (סקירה / אפליקציות / זמן מסך / מכשיר)
- Move existing components to their respective tabs

## Phase C (after B)
- Apps tab: installed_apps inventory UI
- Screen Time tab: schedule windows CRUD UI + Shabbat toggle
- Device tab: polished health view
