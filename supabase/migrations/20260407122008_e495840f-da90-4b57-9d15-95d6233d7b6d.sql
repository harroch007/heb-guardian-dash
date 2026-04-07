
-- Step 1: Create a helper function to extract device_id from JWT app_metadata
CREATE OR REPLACE FUNCTION public.get_device_id_from_jwt()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'device_id')::text;
$$;

-- Step 2: Drop the two unsafe anon policies
DROP POLICY IF EXISTS "Devices can read their own commands" ON public.device_commands;
DROP POLICY IF EXISTS "Devices can update their own commands" ON public.device_commands;

-- Step 3: Create new device-scoped SELECT policy for authenticated device users
CREATE POLICY "Devices can read their own commands (JWT-scoped)"
ON public.device_commands
FOR SELECT
TO authenticated
USING (
  device_id = public.get_device_id_from_jwt()
);

-- Step 4: Create new device-scoped UPDATE policy for authenticated device users
CREATE POLICY "Devices can update their own commands (JWT-scoped)"
ON public.device_commands
FOR UPDATE
TO authenticated
USING (
  device_id = public.get_device_id_from_jwt()
);
