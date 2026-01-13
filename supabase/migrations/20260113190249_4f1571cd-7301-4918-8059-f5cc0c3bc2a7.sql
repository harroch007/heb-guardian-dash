-- מחיקת הגרסה הישנה של update_device_status (סדר פרמטרים: device_id, lat, lon, battery)
DROP FUNCTION IF EXISTS public.update_device_status(text, double precision, double precision, integer);