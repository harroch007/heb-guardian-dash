\set ON_ERROR_STOP on

begin;

do $$
begin
    if exists (
        select 1
        from public.v2_safety_incidents
        where source_platform <> 'whatsapp'
    ) then
        raise exception 'non_whatsapp_v2_incident_exists';
    end if;

    if not exists (
        select 1
        from pg_catalog.pg_constraint constraint_row
        where constraint_row.conname =
            'v2_safety_incidents_source_platform_check'
          and pg_catalog.pg_get_constraintdef(
                constraint_row.oid
              ) like '%source_platform%whatsapp%'
    ) then
        raise exception 'whatsapp_source_platform_constraint_missing';
    end if;
end
$$;

rollback;
