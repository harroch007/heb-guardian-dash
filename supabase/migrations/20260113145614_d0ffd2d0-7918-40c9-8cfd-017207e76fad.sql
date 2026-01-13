-- Drop the legacy 9-parameter overload (keeping only the 11-param superset version)
DROP FUNCTION IF EXISTS public.create_alert(
  text, integer, text, text, text, integer, text, integer, text
);