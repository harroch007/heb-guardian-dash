-- Legacy fallback: anon devices can read their pending commands
-- Scoped to paired devices only (device_id exists in devices with non-null child_id)
CREATE POLICY "Devices can read commands (legacy fallback)"
ON public.device_commands FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.device_id = device_commands.device_id
  AND devices.child_id IS NOT NULL
));

-- Legacy fallback: anon devices can update their commands (ACK/COMPLETE)
-- Scoped to paired devices only
CREATE POLICY "Devices can update commands (legacy fallback)"
ON public.device_commands FOR UPDATE TO anon
USING (EXISTS (
  SELECT 1 FROM public.devices
  WHERE devices.device_id = device_commands.device_id
  AND devices.child_id IS NOT NULL
));