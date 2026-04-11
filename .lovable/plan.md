

# Fix RLS Nesting Bug on `device_commands`

## Problem
The existing `anon` policies on `device_commands` use a direct subquery on `devices`, but `devices` has RLS that blocks `anon` reads. Result: the `EXISTS` always returns `false` and the Android app can never see commands.

## Solution — Single Migration

1. **Create** `public.is_paired_device(p_device_id text)` — a `SECURITY DEFINER` function that checks `devices` bypassing RLS
2. **Drop** the two existing broken policies
3. **Recreate** them using `is_paired_device(device_id)` instead of the subquery

```sql
CREATE OR REPLACE FUNCTION public.is_paired_device(p_device_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devices
    WHERE device_id = p_device_id AND child_id IS NOT NULL
  );
$$;

DROP POLICY "Devices can read commands (legacy fallback)" ON public.device_commands;
DROP POLICY "Devices can update commands (legacy fallback)" ON public.device_commands;

CREATE POLICY "Devices can read commands (legacy fallback)"
ON public.device_commands FOR SELECT TO anon
USING (public.is_paired_device(device_id));

CREATE POLICY "Devices can update commands (legacy fallback)"
ON public.device_commands FOR UPDATE TO anon
USING (public.is_paired_device(device_id));
```

## Impact
- Zero Dashboard code changes
- Zero Android code changes
- Fixes: Ring, Locate, Refresh Settings, Report Heartbeat commands

