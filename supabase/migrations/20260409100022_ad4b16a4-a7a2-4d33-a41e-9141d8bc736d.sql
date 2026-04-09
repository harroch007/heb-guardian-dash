
-- 2-parameter backward-compatibility shim for update_device_status
-- Delegates to the existing 4-parameter version with NULL coordinates
CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.update_device_status(p_device_id, p_battery, NULL::double precision, NULL::double precision);
END;
$$;

-- Match permissions of the existing overloads
REVOKE ALL ON FUNCTION public.update_device_status(text, integer) FROM public;
REVOKE ALL ON FUNCTION public.update_device_status(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_device_status(text, integer) TO authenticated;
