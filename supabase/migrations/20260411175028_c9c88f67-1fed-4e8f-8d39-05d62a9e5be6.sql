-- 1. Create SECURITY DEFINER helper to check device pairing (bypasses devices RLS)
CREATE OR REPLACE FUNCTION public.is_paired_device(p_device_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.devices
    WHERE device_id = p_device_id
    AND child_id IS NOT NULL
  );
$$;

-- 2. Drop the broken policies that use direct subquery on devices table
DROP POLICY IF EXISTS "Devices can read commands (legacy fallback)" ON public.device_commands;
DROP POLICY IF EXISTS "Devices can update commands (legacy fallback)" ON public.device_commands;

-- 3. Recreate with the helper function (no RLS nesting issue)
CREATE POLICY "Devices can read commands (legacy fallback)"
ON public.device_commands FOR SELECT TO anon
USING (public.is_paired_device(device_id));

CREATE POLICY "Devices can update commands (legacy fallback)"
ON public.device_commands FOR UPDATE TO anon
USING (public.is_paired_device(device_id));