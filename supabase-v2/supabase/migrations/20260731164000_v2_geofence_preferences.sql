-- Guardian-owned global geofence preferences for the canonical V2 contract.
-- Individual places continue to use v2_upsert_parental_geofence.

create or replace function public.v2_set_geofence_preferences(
    target_child_id uuid,
    target_home_exit_alert_enabled boolean,
    target_school_exit_alert_enabled boolean,
    target_exit_debounce_seconds integer,
    target_request_key text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    next_revision bigint;
begin
    if actor is null
       or not public.v2_is_child_guardian(target_child_id) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;

    perform public.v2_require_parental_request_key_service(
        target_request_key
    );

    if target_home_exit_alert_enabled is null
       or target_school_exit_alert_enabled is null
       or target_exit_debounce_seconds not between 30 and 3600 then
        raise exception 'invalid_geofence_preferences'
            using errcode = '22023';
    end if;

    insert into public.v2_parental_settings (
        child_id,
        revision,
        home_exit_alert_enabled,
        school_exit_alert_enabled,
        exit_debounce_seconds,
        updated_by
    )
    values (
        target_child_id,
        1,
        target_home_exit_alert_enabled,
        target_school_exit_alert_enabled,
        target_exit_debounce_seconds,
        actor
    )
    on conflict (child_id) do update
       set revision = public.v2_parental_settings.revision + 1,
           home_exit_alert_enabled =
               excluded.home_exit_alert_enabled,
           school_exit_alert_enabled =
               excluded.school_exit_alert_enabled,
           exit_debounce_seconds =
               excluded.exit_debounce_seconds,
           updated_by = actor
    returning revision into next_revision;

    perform public.v2_enqueue_refresh_for_child_service(
        target_child_id,
        actor,
        target_request_key,
        next_revision
    );

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
        'guardian',
        'v2.parental.geofence_preferences.set',
        'child',
        target_child_id,
        'success',
        jsonb_build_object(
            'home_exit_alert_enabled',
            target_home_exit_alert_enabled,
            'school_exit_alert_enabled',
            target_school_exit_alert_enabled,
            'exit_debounce_seconds',
            target_exit_debounce_seconds,
            'revision',
            next_revision
        )
    );

    return next_revision;
end;
$$;

revoke all on function public.v2_set_geofence_preferences(
    uuid,
    boolean,
    boolean,
    integer,
    text
) from public;

grant execute on function public.v2_set_geofence_preferences(
    uuid,
    boolean,
    boolean,
    integer,
    text
) to authenticated;

comment on function public.v2_set_geofence_preferences(
    uuid,
    boolean,
    boolean,
    integer,
    text
) is
    'Updates guardian-owned V2 geofence preferences, bumps the settings revision, audits the change and queues device refresh.';
