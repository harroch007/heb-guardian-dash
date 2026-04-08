
UPDATE public.devices
SET previous_child_id = '6233e88a-0212-4682-a350-442681e95a5f'
WHERE device_id = '9d5a9132b033a86b'
  AND child_id IS NULL
  AND previous_child_id IS NULL;
