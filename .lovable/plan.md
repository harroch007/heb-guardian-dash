

## Recalculation Layer for Nearest Issur Window

### Architecture

The recalculation will be triggered from `update_device_location` (the natural entry point for location updates). The approach:

1. **DB function** (`maybe_recalc_nearest_issur_window`) — pure SQL/plpgsql that checks the 4 conditions and, if met, does the sunset recalculation directly in SQL (no edge function call needed for a single window)
2. **Modify `update_device_location`** — call the recalc function after updating coordinates
3. **No edge function changes** — the NOAA calculation will be ported to a lean plpgsql function for single-window recalc only

### Why plpgsql instead of calling the Edge Function?

- Calling `net.http_post` to the edge function for every location update would be slow and wasteful
- The edge function recalculates all 30 days for all children — overkill for one window
- A plpgsql NOAA sunset function is ~30 lines and runs in microseconds
- No network hop, no cold start, no Hebcal call needed (the window already exists, we just recalculate its times)

### Migration 1: Core recalculation logic

```sql
-- Haversine distance in km
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) RETURNS double precision ...

-- NOAA sunset calculator (single date, single location)
CREATE OR REPLACE FUNCTION public.calc_sunset_utc(
  p_lat double precision, p_lon double precision, p_date date
) RETURNS timestamptz ...

-- Main recalc function
CREATE OR REPLACE FUNCTION public.maybe_recalc_nearest_issur_window(
  p_child_id uuid, p_new_lat double precision, p_new_lon double precision
) RETURNS void ...
```

**Decision rules inside `maybe_recalc_nearest_issur_window`:**
1. Find nearest future window for this child where `start_epoch_ms > now()` and `is_active = true`, ordered by `start_epoch_ms ASC LIMIT 1`
2. Check: `start_epoch_ms - now() < 12 hours` → if not, return (no-op)
3. Check: `haversine_km(window.lat, window.lon, p_new_lat, p_new_lon) > 25` → if not, return (no-op)
4. If both conditions met: recalculate sunset for the relevant dates using `calc_sunset_utc`, apply candle (-18min) and havdalah (+32min) offsets, UPDATE the row

**Logging:** Uses `RAISE LOG` with child_id, event_key, old/new lat/lon, distance, old/new times.

### Migration 2: Hook into `update_device_location`

Add a call at the end of `update_device_location`:

```sql
-- After the UPDATE, look up child_id and call recalc
SELECT child_id INTO v_child_id FROM devices WHERE device_id = p_device_id;
IF v_child_id IS NOT NULL AND p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
  PERFORM public.maybe_recalc_nearest_issur_window(v_child_id, p_lat, p_lon);
END IF;
```

### Files changed

| File | Change |
|---|---|
| `supabase/migrations/new_1.sql` | `haversine_km`, `calc_sunset_utc`, `maybe_recalc_nearest_issur_window` functions |
| `supabase/migrations/new_2.sql` | Updated `update_device_location` with recalc call |

### What stays untouched
- Edge function `calculate-shabbat-times` (30-day cache) — unchanged
- `get_device_settings` RPC — unchanged
- `issur_melacha_windows` table schema — unchanged
- All UI — unchanged
- Android — unchanged
- Cron job — unchanged

### Fallback behavior
If any condition fails (no window, >12h away, <25km, no valid location), the function returns silently and the cached window is used as-is.

