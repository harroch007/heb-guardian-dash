
-- Cleanup trigger: delete old REPORT_HEARTBEAT commands before inserting a new one
CREATE OR REPLACE FUNCTION public.cleanup_old_heartbeat_commands()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.device_commands
  WHERE device_id = NEW.device_id
    AND command_type = 'REPORT_HEARTBEAT'
    AND created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_heartbeat_commands
  BEFORE INSERT ON public.device_commands
  FOR EACH ROW
  WHEN (NEW.command_type = 'REPORT_HEARTBEAT')
  EXECUTE FUNCTION public.cleanup_old_heartbeat_commands();

-- Also add RLS policy so admins can insert commands
CREATE POLICY "Admins can insert device commands"
  ON public.device_commands
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
