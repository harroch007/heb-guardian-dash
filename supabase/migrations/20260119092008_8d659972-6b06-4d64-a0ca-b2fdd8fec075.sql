-- Create function to get top contacts for a child on a specific date
CREATE OR REPLACE FUNCTION public.get_child_top_contacts(
  p_child_id uuid,
  p_date date,
  p_limit integer DEFAULT 3
)
RETURNS TABLE(
  chat_name text,
  chat_type text,
  message_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    dcs.chat_name,
    dcs.chat_type,
    dcs.message_count::integer
  FROM daily_chat_stats dcs
  WHERE dcs.child_id = p_child_id
    AND dcs.stat_date = p_date
  ORDER BY dcs.message_count DESC
  LIMIT p_limit;
$$;