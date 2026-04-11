

# Piggyback Enforcement State on update_device_status

## Summary
Modify `update_device_status` to return a JSON object with the current enforcement state instead of `void`. The server computes whether the child is blocked right now, so Android just reads the answer.

## Current State
- `update_device_status` returns `void`, accepts 6 params (device_id, battery, lat, lon, model, manufacturer)
- Schedule data exists in `schedule_windows` (types: bedtime, shabbat, school, etc.)
- Screen time usage tracked in `app_usage` table (per-day per-app minutes)
- Daily limits in `settings.daily_screen_time_limit_minutes` + `bonus_time_grants`
- Shabbat windows in `issur_melacha_windows` and `shabbat_zmanim`

## Changes — Single Migration

### Modify `update_device_status` RPC:
1. **Change return type** from `void` to `jsonb`
2. After the existing UPDATE, compute enforcement state:
   - Look up `child_id` from `devices`
   - **Schedule check**: Query `schedule_windows` where `is_active = true` for this child. For each active schedule, check if current time (Asia/Jerusalem) falls within the window (handling overnight windows where `start_time > end_time` with OR logic)
   - **Issur melacha check**: Query `issur_melacha_windows` where `start_at <= now() AND end_at > now()`
   - **Daily limit check**: Sum `usage_minutes` from `app_usage` for today's date, compare against `effective_limit_minutes` (base + bonus)
3. **Return JSON**:
```json
{
  "success": true,
  "is_blocked_now": true/false,
  "block_reason": "BEDTIME" | "SCHOOL" | "SHABBAT" | "DAILY_LIMIT_REACHED" | null,
  "effective_limit_minutes": 120,
  "used_minutes_today": 45
}
```

### Enforcement priority (first match wins):
1. `issur_melacha_windows` active → `"SHABBAT"`
2. Shabbat schedule active + within shabbat zmanim window → `"SHABBAT"`
3. Bedtime schedule active + within time window → `"BEDTIME"`
4. School/custom schedule active + within time window → `"SCHOOL"`
5. Daily limit reached → `"DAILY_LIMIT_REACHED"`
6. Otherwise → `is_blocked_now: false, block_reason: null`

## Files Changed
- **One new migration file** — no frontend or Android changes needed.

## Result
Android calls `update_device_status` as usual, reads the returned JSON, and locks/unlocks instantly. No schedule parsing needed on-device.

