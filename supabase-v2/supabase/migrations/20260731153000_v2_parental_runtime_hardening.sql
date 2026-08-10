begin;

-- A device process can die after claiming a command and before acknowledging
-- it. Reclaiming a bounded stale lease prevents an otherwise permanent
-- command loss while the command TTL still bounds duplicate execution.
create or replace function public.v2_claim_device_commands_service(
    target_device_id uuid,
    requested_limit smallint default 10
)
returns table (
    id uuid,
    command_type text,
    payload jsonb,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
    if requested_limit not between 1 and 20 then
        raise exception 'invalid_command_limit'
            using errcode = '22023';
    end if;

    update public.v2_device_commands command
       set status = 'expired'
     where command.device_id = target_device_id
       and command.status in ('pending', 'claimed')
       and command.expires_at <= now();

    update public.v2_device_commands command
       set status = 'pending',
           claimed_at = null
     where command.device_id = target_device_id
       and command.status = 'claimed'
       and command.claimed_at <= now() - interval '5 minutes'
       and command.expires_at > now();

    return query
    with claimable as (
        select command.id
          from public.v2_device_commands command
         where command.device_id = target_device_id
           and command.status = 'pending'
           and command.not_before <= now()
           and command.expires_at > now()
         order by command.created_at
         limit requested_limit
         for update skip locked
    )
    update public.v2_device_commands command
       set status = 'claimed',
           claimed_at = now()
      from claimable
     where command.id = claimable.id
    returning
        command.id,
        command.command_type,
        command.payload,
        command.expires_at;
end;
$$;

create table public.v2_parental_geofence_events (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null
        references public.v2_protected_devices(id) on delete cascade,
    event_key uuid not null,
    geofence_id uuid not null
        references public.v2_parental_geofences(id) on delete cascade,
    transition text not null check (transition in ('enter', 'exit')),
    latitude double precision check (latitude between -90 and 90),
    longitude double precision check (longitude between -180 and 180),
    location_accuracy_meters real check (
        location_accuracy_meters is null
        or location_accuracy_meters between 0 and 100000
    ),
    occurred_at timestamptz not null,
    received_at timestamptz not null default now(),
    unique (device_id, event_key),
    check (
        (latitude is null and longitude is null)
        or (latitude is not null and longitude is not null)
    ),
    check (occurred_at <= received_at + interval '10 minutes')
);

create index v2_parental_geofence_events_device_time
    on public.v2_parental_geofence_events(device_id, occurred_at desc);

create or replace function public.v2_report_geofence_events_service(
    target_device_id uuid,
    target_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_child_id uuid;
    event_item jsonb;
    inserted_count integer := 0;
    row_count_value integer;
    event_occurred_at timestamptz;
    event_latitude double precision;
    event_longitude double precision;
    event_accuracy real;
begin
    if target_events is null
       or jsonb_typeof(target_events) <> 'array'
       or jsonb_array_length(target_events) > 100 then
        raise exception 'invalid_geofence_events'
            using errcode = '22023';
    end if;

    select device.child_id
      into target_child_id
      from public.v2_protected_devices device
     where device.id = target_device_id
       and device.status in ('active', 'degraded');
    if target_child_id is null then
        raise exception 'device_not_active'
            using errcode = '42501';
    end if;

    for event_item in
        select value from jsonb_array_elements(target_events)
    loop
        if event_item->>'event_key' is null
           or event_item->>'geofence_id' is null
           or event_item->>'transition' not in ('enter', 'exit')
           or event_item->>'occurred_at' is null then
            raise exception 'invalid_geofence_event'
                using errcode = '22023';
        end if;

        event_occurred_at := (event_item->>'occurred_at')::timestamptz;
        event_latitude := (event_item->>'latitude')::double precision;
        event_longitude := (event_item->>'longitude')::double precision;
        event_accuracy :=
            (event_item->>'location_accuracy_meters')::real;

        if event_occurred_at < now() - interval '7 days'
           or event_occurred_at > now() + interval '10 minutes'
           or (event_latitude is null) <> (event_longitude is null)
           or (
               event_latitude is not null
               and event_latitude not between -90 and 90
           )
           or (
               event_longitude is not null
               and event_longitude not between -180 and 180
           )
           or (
               event_accuracy is not null
               and event_accuracy not between 0 and 100000
           )
           or not exists (
               select 1
                 from public.v2_parental_geofences geofence
                where geofence.id =
                          (event_item->>'geofence_id')::uuid
                  and geofence.child_id = target_child_id
           ) then
            raise exception 'invalid_geofence_event'
                using errcode = '22023';
        end if;

        insert into public.v2_parental_geofence_events (
            device_id,
            event_key,
            geofence_id,
            transition,
            latitude,
            longitude,
            location_accuracy_meters,
            occurred_at
        )
        values (
            target_device_id,
            (event_item->>'event_key')::uuid,
            (event_item->>'geofence_id')::uuid,
            event_item->>'transition',
            event_latitude,
            event_longitude,
            event_accuracy,
            event_occurred_at
        )
        on conflict (device_id, event_key) do nothing;
        get diagnostics row_count_value = row_count;
        inserted_count := inserted_count + row_count_value;
    end loop;

    return inserted_count;
end;
$$;

alter table public.v2_parental_geofence_events enable row level security;
alter table public.v2_parental_geofence_events force row level security;

create policy v2_guardians_read_parental_geofence_events
on public.v2_parental_geofence_events for select
to authenticated
using (public.v2_is_device_guardian(device_id));

revoke all on table public.v2_parental_geofence_events
from anon, authenticated;
grant select on table public.v2_parental_geofence_events
to authenticated;

revoke all on function public.v2_report_geofence_events_service(
    uuid,
    jsonb
) from public, anon, authenticated;
grant execute on function public.v2_report_geofence_events_service(
    uuid,
    jsonb
) to service_role;

-- Schedule/geofence changes are sensitive guardian actions. The base
-- functions authorize them; these triggers add the missing append-only audit.
create or replace function public.v2_audit_parental_rule_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    target_id uuid;
    target_child_id uuid;
begin
    target_id := case when tg_op = 'DELETE' then old.id else new.id end;
    target_child_id := case
        when tg_op = 'DELETE' then old.child_id
        else new.child_id
    end;
    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        actor,
        case when actor is null then 'service' else 'guardian' end,
        'v2.parental.' || lower(tg_table_name) || '.' || lower(tg_op),
        tg_table_name,
        target_id,
        'success',
        jsonb_build_object('child_id', target_child_id)
    );
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger v2_parental_schedules_audit
after insert or update or delete on public.v2_parental_schedules
for each row execute function public.v2_audit_parental_rule_change();

create trigger v2_parental_geofences_audit
after insert or update or delete on public.v2_parental_geofences
for each row execute function public.v2_audit_parental_rule_change();

revoke all on function public.v2_audit_parental_rule_change()
from public, anon, authenticated;

commit;
