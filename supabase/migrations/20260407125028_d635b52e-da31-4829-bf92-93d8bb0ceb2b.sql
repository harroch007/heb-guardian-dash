-- Step 1: Revoke public execute, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.get_device_settings(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_device_settings(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_device_settings(text) TO authenticated;