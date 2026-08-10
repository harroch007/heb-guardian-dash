-- Supabase applies explicit default EXECUTE grants to API roles when a
-- function is created. Revoke the anonymous grant explicitly.

revoke execute on function public.v2_set_geofence_preferences(
    uuid,
    boolean,
    boolean,
    integer,
    text
) from anon;

grant execute on function public.v2_set_geofence_preferences(
    uuid,
    boolean,
    boolean,
    integer,
    text
) to authenticated;
