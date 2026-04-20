-- Fix permissions for get_device_settings RPC so Android device (anon role) can call it

REVOKE ALL ON FUNCTION public.get_device_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_device_settings(text) TO anon, authenticated, service_role;

-- Ensure ownership is postgres so SECURITY DEFINER can bypass RLS
ALTER FUNCTION public.get_device_settings(text) OWNER TO postgres;

-- Reload PostgREST schema cache so new permissions take effect immediately
NOTIFY pgrst, 'reload schema';