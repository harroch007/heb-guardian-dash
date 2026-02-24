
-- Step 1: Clean up existing duplicate settings (keep only the latest per child)
DELETE FROM settings
WHERE device_id IS NULL
  AND parent_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (child_id) id
    FROM settings
    WHERE device_id IS NULL AND parent_id IS NOT NULL
    ORDER BY child_id, updated_at DESC
  );

-- Step 2: Add unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_settings_child_no_device
ON settings (child_id) WHERE device_id IS NULL AND parent_id IS NOT NULL;
