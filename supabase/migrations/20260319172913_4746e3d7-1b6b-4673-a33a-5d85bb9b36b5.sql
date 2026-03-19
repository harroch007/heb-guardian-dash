
-- MISSION 2: Days mapping data migration 0-6 → 1-7
UPDATE schedule_windows
SET days_of_week = (
  SELECT array_agg(d + 1 ORDER BY d)
  FROM unnest(days_of_week) AS d
)
WHERE days_of_week IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(days_of_week) AS d WHERE d BETWEEN 0 AND 6
  )
  AND NOT EXISTS (
    SELECT 1 FROM unnest(days_of_week) AS d WHERE d = 7
  );
