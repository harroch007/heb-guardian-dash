CREATE OR REPLACE FUNCTION notify_child_chore_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO device_commands (device_id, command_type, status)
  SELECT d.device_id, 'REFRESH_CHORES', 'PENDING'
  FROM devices d
  WHERE d.child_id = OLD.child_id;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_chore_deleted_notify
  AFTER DELETE ON chores
  FOR EACH ROW
  EXECUTE FUNCTION notify_child_chore_deleted();