
-- Backfill previous_child_id for devices disconnected before tracking was added
UPDATE public.devices d
SET previous_child_id = (
  SELECT (au.raw_app_meta_data->>'child_id')::uuid
  FROM auth.users au
  WHERE au.id = d.auth_user_id
    AND au.raw_app_meta_data->>'child_id' IS NOT NULL
)
WHERE d.child_id IS NULL
  AND d.previous_child_id IS NULL
  AND d.auth_user_id IS NOT NULL;
