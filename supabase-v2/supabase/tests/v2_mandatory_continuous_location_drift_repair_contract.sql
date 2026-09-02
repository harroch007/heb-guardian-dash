\set ON_ERROR_STOP on

begin;

insert into public.v2_families (id, display_name)
values (
    '22000000-0000-0000-0000-000000000001',
    'Mandatory location repair family'
);

insert into public.v2_children (id, family_id, display_name)
values (
    '32000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    'Mandatory location repair child'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
)
values (
    '42000000-0000-4000-8000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '2.0.0-contract',
    'active'
);

do $$
declare
    default_expression text;
    constraint_validated boolean;
    settings_value boolean;
    settings_snapshot jsonb;
    stored_latitude double precision;
    stored_longitude double precision;
    stored_location_observed_at timestamptz;
    original_location_observed_at timestamptz := date_trunc(
        'second',
        now() - interval '1 minute'
    );
begin
    select pg_get_expr(default_row.adbin, default_row.adrelid)
      into default_expression
      from pg_attribute attribute_row
      join pg_class table_row
        on table_row.oid = attribute_row.attrelid
      join pg_namespace namespace_row
        on namespace_row.oid = table_row.relnamespace
      left join pg_attrdef default_row
        on default_row.adrelid = attribute_row.attrelid
       and default_row.adnum = attribute_row.attnum
     where namespace_row.nspname = 'public'
       and table_row.relname = 'v2_parental_settings'
       and attribute_row.attname = 'location_tracking_enabled'
       and not attribute_row.attisdropped;

    if default_expression is distinct from 'true' then
        raise exception 'Mandatory location default drifted: %',
            default_expression;
    end if;

    select constraint_row.convalidated
      into constraint_validated
      from pg_constraint constraint_row
     where constraint_row.conrelid =
               'public.v2_parental_settings'::regclass
       and constraint_row.conname =
               'v2_parental_settings_location_tracking_mandatory'
       and constraint_row.contype = 'c';

    if constraint_validated is distinct from true then
        raise exception 'Mandatory location constraint is missing or invalid';
    end if;

    begin
        insert into public.v2_parental_settings (
            child_id,
            location_tracking_enabled
        )
        values (
            '32000000-0000-0000-0000-000000000001',
            false
        );

        raise exception 'Mandatory location constraint accepted false';
    exception
        when check_violation then
            null;
    end;

    insert into public.v2_parental_settings (child_id)
    values ('32000000-0000-0000-0000-000000000001')
    returning location_tracking_enabled into settings_value;

    if settings_value is distinct from true then
        raise exception 'Mandatory location default did not produce true';
    end if;

    select public.v2_parental_settings_snapshot_service(
        '42000000-0000-4000-8000-000000000001'
    )
      into settings_snapshot;

    if (settings_snapshot->>'location_tracking_enabled')::boolean
       is distinct from true then
        raise exception 'Device snapshot did not enforce mandatory location';
    end if;

    perform public.v2_report_parental_state_service(
        '42000000-0000-4000-8000-000000000001',
        '62000000-0000-4000-8000-000000000001',
        1,
        current_date,
        0::smallint,
        32.0853::double precision,
        34.7818::double precision,
        10::real,
        'Contract location',
        original_location_observed_at,
        original_location_observed_at,
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb
    );

    perform public.v2_report_parental_state_service(
        '42000000-0000-4000-8000-000000000001',
        '62000000-0000-4000-8000-000000000002',
        1,
        current_date,
        0::smallint,
        null::double precision,
        null::double precision,
        null::real,
        null::text,
        null::timestamptz,
        now(),
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb
    );

    select
        state_row.latitude,
        state_row.longitude,
        state_row.location_observed_at
      into
        stored_latitude,
        stored_longitude,
        stored_location_observed_at
      from public.v2_parental_device_state state_row
     where state_row.device_id =
               '42000000-0000-4000-8000-000000000001';

    if stored_latitude is distinct from 32.0853::double precision
       or stored_longitude is distinct from 34.7818::double precision
       or stored_location_observed_at is distinct from
            original_location_observed_at then
        raise exception
            'Location preservation contract failed: %, %, %',
            stored_latitude,
            stored_longitude,
            stored_location_observed_at;
    end if;

    if col_description(
        'public.v2_parental_settings'::regclass,
        (
            select attribute_row.attnum
              from pg_attribute attribute_row
             where attribute_row.attrelid =
                       'public.v2_parental_settings'::regclass
               and attribute_row.attname =
                       'location_tracking_enabled'
               and not attribute_row.attisdropped
        )
    ) is distinct from
        'Mandatory continuous-location switch. Always true for protected children.'
    then
        raise exception 'Mandatory location column comment drifted';
    end if;
end;
$$;

rollback;
