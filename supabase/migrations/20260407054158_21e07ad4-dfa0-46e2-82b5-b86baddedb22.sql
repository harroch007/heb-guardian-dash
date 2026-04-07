
-- Trigger function: enqueue REFRESH_SETTINGS for all devices of the affected child
CREATE OR REPLACE FUNCTION public.enqueue_geofence_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_child_id uuid;
BEGIN
  -- Resolve child_id from NEW or OLD (DELETE has no NEW)
  IF TG_OP = 'DELETE' THEN
    v_child_id := OLD.child_id;
  ELSE
    v_child_id := NEW.child_id;
  END IF;

  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_SETTINGS', 'PENDING'
  FROM devices d
  WHERE d.child_id = v_child_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger on child_places (covers HOME/SCHOOL/MANUAL create, update, delete)
CREATE TRIGGER trg_child_places_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.child_places
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_geofence_refresh();

-- Trigger on child_geofence_settings (covers settings insert and update)
CREATE TRIGGER trg_child_geofence_settings_refresh
AFTER INSERT OR UPDATE ON public.child_geofence_settings
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_geofence_refresh();
