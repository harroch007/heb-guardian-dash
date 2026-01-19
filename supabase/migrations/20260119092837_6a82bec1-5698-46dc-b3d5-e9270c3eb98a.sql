-- Create function to get top apps for a child on a specific date
CREATE OR REPLACE FUNCTION public.get_child_top_apps(
  p_child_id uuid,
  p_date date,
  p_limit integer DEFAULT 3
)
RETURNS TABLE(
  app_name text,
  package_name text,
  usage_minutes integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    au.app_name,
    au.package_name,
    au.usage_minutes::integer
  FROM app_usage au
  JOIN devices d ON d.device_id = au.device_id
  WHERE d.child_id = p_child_id
    AND au.usage_date = p_date
  ORDER BY au.usage_minutes DESC NULLS LAST
  LIMIT p_limit;
$$;