begin;

alter table public.v2_device_health_events
    add column contract_version smallint not null default 1
        check (contract_version between 1 and 32),
    add column boot_session_id uuid,
    add column sequence_no bigint check (sequence_no is null or sequence_no > 0),
    add column report_reason text not null default 'legacy'
        check (report_reason in (
            'legacy', 'runtime_started', 'periodic', 'capability_changed',
            'boot', 'guardian_requested'
        )),
    add column expected_interval_seconds integer not null default 900
        check (expected_interval_seconds between 60 and 3600),
    add column product_ready boolean,
    add column app_version text,
    add column battery_level_percent smallint
        check (
            battery_level_percent is null
            or battery_level_percent between 0 and 100
        ),
    add column capabilities jsonb not null default '{}'::jsonb
        check (jsonb_typeof(capabilities) = 'object'),
    add column payload_hash text
        check (payload_hash is null or char_length(payload_hash) = 64),
    add column affects_current_state boolean not null default false;

create unique index v2_health_device_boot_sequence
    on public.v2_device_health_events(
        device_id, boot_session_id, sequence_no
    )
    where boot_session_id is not null and sequence_no is not null;

create table public.v2_device_monitoring_state (
    device_id uuid primary key
        references public.v2_protected_devices(id) on delete cascade,
    monitoring_state text not null default 'awaiting_first_heartbeat'
        check (monitoring_state in (
            'awaiting_first_heartbeat', 'protected', 'degraded',
            'action_required', 'heartbeat_late', 'interrupted',
            'recovering', 'revoked'
        )),
    state_version bigint not null default 0 check (state_version >= 0),
    episode_id uuid,
    reason_codes text[] not null default '{}',
    last_health_event_id uuid
        references public.v2_device_health_events(id) on delete set null,
    last_event_key uuid,
    last_boot_session_id uuid,
    last_sequence_no bigint,
    last_observed_at timestamptz,
    last_received_at timestamptz,
    expected_interval_seconds integer not null default 120
        check (expected_interval_seconds between 60 and 3600),
    late_after_at timestamptz,
    interrupted_after_at timestamptz,
    interruption_started_at timestamptz,
    healthy_streak smallint not null default 0
        check (healthy_streak between 0 and 10),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index v2_monitoring_state_sweep
    on public.v2_device_monitoring_state(
        monitoring_state, late_after_at, interrupted_after_at
    )
    where monitoring_state not in ('interrupted', 'revoked');

create table public.v2_device_monitoring_transitions (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null
        references public.v2_protected_devices(id) on delete cascade,
    health_event_id uuid
        references public.v2_device_health_events(id) on delete set null,
    episode_id uuid,
    previous_state text,
    new_state text not null,
    reason_codes text[] not null default '{}',
    source text not null check (source in ('heartbeat', 'sweeper', 'system')),
    state_version bigint not null check (state_version > 0),
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (device_id, state_version)
);

create index v2_monitoring_transitions_device_created
    on public.v2_device_monitoring_transitions(device_id, created_at desc);

create table public.v2_monitoring_alert_deliveries (
    id uuid primary key default gen_random_uuid(),
    transition_id uuid not null
        references public.v2_device_monitoring_transitions(id) on delete cascade,
    guardian_user_id uuid not null
        references auth.users(id) on delete cascade,
    alert_type text not null check (alert_type in (
        'monitoring_action_required', 'monitoring_late',
        'monitoring_interrupted', 'monitoring_restored'
    )),
    severity text not null check (severity in ('info', 'warning', 'critical')),
    status text not null default 'queued'
        check (status in (
            'queued', 'provider_accepted', 'delivered', 'failed',
            'opened', 'acknowledged', 'suppressed'
        )),
    idempotency_key text not null unique,
    provider_message_id text,
    failure_code text,
    attempted_at timestamptz,
    delivered_at timestamptz,
    opened_at timestamptz,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    unique (transition_id, guardian_user_id, alert_type)
);

create index v2_monitoring_alert_outbox
    on public.v2_monitoring_alert_deliveries(status, created_at)
    where status in ('queued', 'failed');

create table public.v2_guardian_push_endpoints (
    id uuid primary key default gen_random_uuid(),
    guardian_user_id uuid not null
        references auth.users(id) on delete cascade,
    installation_id uuid not null,
    endpoint text not null,
    endpoint_hash text not null unique
        check (char_length(endpoint_hash) = 64),
    p256dh text not null,
    auth_secret text not null,
    user_agent text,
    locale text,
    permission_state text not null default 'granted'
        check (permission_state in ('granted', 'denied', 'prompt')),
    status text not null default 'active'
        check (status in ('active', 'revoked', 'invalid')),
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (guardian_user_id, installation_id)
);

create trigger v2_monitoring_state_set_updated_at
before update on public.v2_device_monitoring_state
for each row execute function public.v2_set_updated_at();

create trigger v2_guardian_push_endpoints_set_updated_at
before update on public.v2_guardian_push_endpoints
for each row execute function public.v2_set_updated_at();

create or replace function public.v2_initialize_monitoring_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.v2_device_monitoring_state(device_id)
    values (new.id)
    on conflict (device_id) do nothing;
    return new;
end;
$$;

create trigger v2_protected_device_initialize_monitoring
after insert on public.v2_protected_devices
for each row execute function public.v2_initialize_monitoring_state();

insert into public.v2_device_monitoring_state(device_id)
select device.id
  from public.v2_protected_devices device
on conflict (device_id) do nothing;

create or replace function public.v2_enqueue_monitoring_alerts_service(
    target_transition_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    transition public.v2_device_monitoring_transitions%rowtype;
    resolved_alert_type text;
    resolved_severity text;
begin
    select *
      into transition
      from public.v2_device_monitoring_transitions item
     where item.id = target_transition_id;

    if transition.id is null then
        return;
    end if;

    resolved_alert_type := case
        when transition.new_state = 'action_required'
            then 'monitoring_action_required'
        when transition.new_state = 'heartbeat_late'
            then 'monitoring_late'
        when transition.new_state = 'interrupted'
            then 'monitoring_interrupted'
        when transition.new_state in ('protected', 'degraded')
             and transition.previous_state = 'recovering'
            then 'monitoring_restored'
        else null
    end;
    if resolved_alert_type is null then
        return;
    end if;

    resolved_severity := case resolved_alert_type
        when 'monitoring_interrupted' then 'critical'
        when 'monitoring_restored' then 'info'
        else 'warning'
    end;

    insert into public.v2_monitoring_alert_deliveries (
        transition_id,
        guardian_user_id,
        alert_type,
        severity,
        idempotency_key
    )
    select
        transition.id,
        membership.guardian_user_id,
        resolved_alert_type,
        resolved_severity,
        resolved_alert_type || ':' ||
            transition.id::text || ':' ||
            membership.guardian_user_id::text
      from public.v2_protected_devices device
      join public.v2_children child
        on child.id = device.child_id
      join public.v2_guardian_memberships membership
        on membership.family_id = child.family_id
       and membership.status = 'active'
     where device.id = transition.device_id
    on conflict (transition_id, guardian_user_id, alert_type) do nothing;
end;
$$;

create or replace function public.v2_report_device_health_v2_service(
    target_device_id uuid,
    target_event_key uuid,
    target_contract_version smallint,
    target_boot_session_id uuid,
    target_sequence_no bigint,
    target_report_reason text,
    target_expected_interval_seconds integer,
    target_capture_ready boolean,
    target_product_ready boolean,
    target_accessibility_enabled boolean,
    target_notification_listener_enabled boolean,
    target_battery_optimization_exempt boolean,
    target_oem_autostart_state text,
    target_degraded_reasons text[],
    target_observed_at timestamptz,
    target_app_version text,
    target_battery_level_percent smallint,
    target_capabilities jsonb
)
returns table (
    accepted boolean,
    duplicate boolean,
    affects_current_state boolean,
    monitoring_state text,
    state_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    existing_event public.v2_device_health_events%rowtype;
    inserted_event public.v2_device_health_events%rowtype;
    current_state public.v2_device_monitoring_state%rowtype;
    computed_payload_hash text;
    affects_current boolean;
    next_state text;
    next_version bigint;
    next_streak smallint;
    next_episode_id uuid;
    transition_episode_id uuid;
    transition_id uuid;
begin
    if target_contract_version < 2
       or target_sequence_no <= 0
       or target_report_reason not in (
           'runtime_started', 'periodic', 'capability_changed',
           'boot', 'guardian_requested'
       )
       or target_expected_interval_seconds not between 60 and 3600
       or char_length(target_app_version) not between 1 and 80
       or target_battery_level_percent not between 0 and 100
       or jsonb_typeof(target_capabilities) <> 'object'
       or octet_length(target_capabilities::text) > 16384
       or coalesce(array_length(target_degraded_reasons, 1), 0) > 16
       or exists (
           select 1
             from unnest(target_degraded_reasons) reason
            where char_length(reason) > 80
       )
       or target_observed_at > now() + interval '10 minutes'
       or target_observed_at < now() - interval '24 hours' then
        raise exception 'invalid_health_report'
            using errcode = '22023';
    end if;

    computed_payload_hash := encode(
        extensions.digest(
            convert_to(
                jsonb_build_object(
                    'event_key', target_event_key,
                    'contract_version', target_contract_version,
                    'boot_session_id', target_boot_session_id,
                    'sequence_no', target_sequence_no,
                    'report_reason', target_report_reason,
                    'expected_interval_seconds',
                        target_expected_interval_seconds,
                    'capture_ready', target_capture_ready,
                    'product_ready', target_product_ready,
                    'accessibility_enabled', target_accessibility_enabled,
                    'notification_listener_enabled',
                        target_notification_listener_enabled,
                    'battery_optimization_exempt',
                        target_battery_optimization_exempt,
                    'oem_autostart_state', target_oem_autostart_state,
                    'degraded_reasons',
                        coalesce(target_degraded_reasons, '{}'::text[]),
                    'observed_at', target_observed_at,
                    'app_version', target_app_version,
                    'battery_level_percent', target_battery_level_percent,
                    'capabilities', target_capabilities
                )::text,
                'UTF8'
            ),
            'sha256'
        ),
        'hex'
    );

    select *
      into existing_event
      from public.v2_device_health_events event
     where event.device_id = target_device_id
       and (
           event.event_key = target_event_key
           or (
               event.boot_session_id = target_boot_session_id
               and event.sequence_no = target_sequence_no
           )
       );

    if existing_event.id is not null then
        if existing_event.event_key <> target_event_key
           or existing_event.payload_hash is distinct from computed_payload_hash then
            raise exception 'event_key_payload_mismatch'
                using errcode = '23505';
        end if;
        select *
          into current_state
          from public.v2_device_monitoring_state state
         where state.device_id = target_device_id;
        return query
        select
            false,
            true,
            existing_event.affects_current_state,
            current_state.monitoring_state,
            current_state.state_version;
        return;
    end if;

    insert into public.v2_device_health_events (
        device_id,
        event_key,
        capture_ready,
        accessibility_enabled,
        notification_listener_enabled,
        battery_optimization_exempt,
        oem_autostart_state,
        degraded_reasons,
        observed_at,
        contract_version,
        boot_session_id,
        sequence_no,
        report_reason,
        expected_interval_seconds,
        product_ready,
        app_version,
        battery_level_percent,
        capabilities,
        payload_hash,
        affects_current_state
    )
    values (
        target_device_id,
        target_event_key,
        target_capture_ready,
        target_accessibility_enabled,
        target_notification_listener_enabled,
        target_battery_optimization_exempt,
        target_oem_autostart_state,
        coalesce(target_degraded_reasons, '{}'::text[]),
        target_observed_at,
        target_contract_version,
        target_boot_session_id,
        target_sequence_no,
        target_report_reason,
        target_expected_interval_seconds,
        target_product_ready,
        target_app_version,
        target_battery_level_percent,
        target_capabilities,
        computed_payload_hash,
        false
    )
    returning * into inserted_event;

    insert into public.v2_device_monitoring_state(device_id)
    values (target_device_id)
    on conflict (device_id) do nothing;

    select *
      into current_state
      from public.v2_device_monitoring_state state
     where state.device_id = target_device_id
     for update;

    affects_current :=
        target_observed_at >= now() - interval '10 minutes'
        and (
            current_state.last_observed_at is null
            or target_observed_at >= current_state.last_observed_at
        )
        and (
            current_state.last_boot_session_id is null
            or current_state.last_boot_session_id <> target_boot_session_id
            or target_sequence_no > current_state.last_sequence_no
        );

    if not affects_current then
        return query
        select
            true,
            false,
            false,
            current_state.monitoring_state,
            current_state.state_version;
        return;
    end if;

    next_streak := case
        when target_capture_ready
            then least(current_state.healthy_streak + 1, 10)
        else 0
    end;

    next_state := case
        when not target_capture_ready then 'action_required'
        when current_state.monitoring_state in (
            'heartbeat_late', 'interrupted', 'action_required'
        ) then 'recovering'
        when current_state.monitoring_state = 'recovering'
             and next_streak < 2 then 'recovering'
        when not target_product_ready then 'degraded'
        else 'protected'
    end;

    next_version := current_state.state_version +
        case
            when next_state <> current_state.monitoring_state then 1
            else 0
        end;
    transition_episode_id := current_state.episode_id;
    next_episode_id := case
        when next_state in ('action_required', 'heartbeat_late', 'interrupted')
            then coalesce(current_state.episode_id, gen_random_uuid())
        when next_state = 'recovering'
            then coalesce(current_state.episode_id, gen_random_uuid())
        else null
    end;
    if transition_episode_id is null then
        transition_episode_id := next_episode_id;
    end if;

    update public.v2_device_health_events
       set affects_current_state = true
     where id = inserted_event.id;

    update public.v2_device_monitoring_state
       set monitoring_state = next_state,
           state_version = next_version,
           episode_id = next_episode_id,
           reason_codes =
               coalesce(target_degraded_reasons, '{}'::text[]),
           last_health_event_id = inserted_event.id,
           last_event_key = target_event_key,
           last_boot_session_id = target_boot_session_id,
           last_sequence_no = target_sequence_no,
           last_observed_at = target_observed_at,
           last_received_at = now(),
           expected_interval_seconds = target_expected_interval_seconds,
           late_after_at = now() + (
               greatest(target_expected_interval_seconds * 2, 300)
               * interval '1 second'
           ),
           interrupted_after_at = now() + (
               greatest(target_expected_interval_seconds * 5, 900)
               * interval '1 second'
           ),
           interruption_started_at = case
               when next_state in (
                   'action_required', 'heartbeat_late', 'interrupted'
               ) then coalesce(interruption_started_at, now())
               when next_state = 'recovering' then interruption_started_at
               else null
           end,
           healthy_streak = next_streak
     where device_id = target_device_id;

    update public.v2_protected_devices
       set last_seen_at = now(),
           status = case
               when target_capture_ready then 'active'
               else 'degraded'
           end
     where id = target_device_id
       and status <> 'revoked';

    if next_state <> current_state.monitoring_state then
        insert into public.v2_device_monitoring_transitions (
            device_id,
            health_event_id,
            episode_id,
            previous_state,
            new_state,
            reason_codes,
            source,
            state_version
        )
        values (
            target_device_id,
            inserted_event.id,
            transition_episode_id,
            current_state.monitoring_state,
            next_state,
            coalesce(target_degraded_reasons, '{}'::text[]),
            'heartbeat',
            next_version
        )
        returning id into transition_id;

        perform public.v2_enqueue_monitoring_alerts_service(transition_id);
    end if;

    return query
    select true, false, true, next_state, next_version;
end;
$$;

create or replace function public.v2_sweep_monitoring_liveness_service(
    target_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    state public.v2_device_monitoring_state%rowtype;
    next_state text;
    next_version bigint;
    next_episode_id uuid;
    transition_id uuid;
    changed_count integer := 0;
begin
    for state in
        select monitoring.*
          from public.v2_device_monitoring_state monitoring
          join public.v2_protected_devices device
            on device.id = monitoring.device_id
         where device.status <> 'revoked'
           and monitoring.monitoring_state not in (
               'awaiting_first_heartbeat', 'interrupted', 'revoked'
           )
           and (
               monitoring.late_after_at <= target_now
               or monitoring.interrupted_after_at <= target_now
           )
         for update of monitoring
    loop
        next_state := case
            when state.interrupted_after_at <= target_now then 'interrupted'
            when state.late_after_at <= target_now then 'heartbeat_late'
            else state.monitoring_state
        end;
        if next_state = state.monitoring_state then
            continue;
        end if;

        next_version := state.state_version + 1;
        next_episode_id := coalesce(state.episode_id, gen_random_uuid());
        update public.v2_device_monitoring_state
           set monitoring_state = next_state,
               state_version = next_version,
               episode_id = next_episode_id,
               interruption_started_at =
                   coalesce(interruption_started_at, target_now),
               reason_codes = array['heartbeat_timeout'],
               healthy_streak = 0
         where device_id = state.device_id;

        insert into public.v2_device_monitoring_transitions (
            device_id,
            episode_id,
            previous_state,
            new_state,
            reason_codes,
            source,
            state_version,
            occurred_at
        )
        values (
            state.device_id,
            next_episode_id,
            state.monitoring_state,
            next_state,
            array['heartbeat_timeout'],
            'sweeper',
            next_version,
            target_now
        )
        returning id into transition_id;

        perform public.v2_enqueue_monitoring_alerts_service(transition_id);
        changed_count := changed_count + 1;
    end loop;
    return changed_count;
end;
$$;

alter table public.v2_device_monitoring_state enable row level security;
alter table public.v2_device_monitoring_state force row level security;
alter table public.v2_device_monitoring_transitions enable row level security;
alter table public.v2_device_monitoring_transitions force row level security;
alter table public.v2_monitoring_alert_deliveries enable row level security;
alter table public.v2_monitoring_alert_deliveries force row level security;
alter table public.v2_guardian_push_endpoints enable row level security;
alter table public.v2_guardian_push_endpoints force row level security;

create policy v2_guardians_read_monitoring_state
on public.v2_device_monitoring_state for select
to authenticated
using (
    exists (
        select 1
          from public.v2_protected_devices device
          join public.v2_children child on child.id = device.child_id
         where device.id = v2_device_monitoring_state.device_id
           and public.v2_is_family_guardian(child.family_id)
    )
);

create policy v2_guardians_read_monitoring_transitions
on public.v2_device_monitoring_transitions for select
to authenticated
using (
    exists (
        select 1
          from public.v2_protected_devices device
          join public.v2_children child on child.id = device.child_id
         where device.id = v2_device_monitoring_transitions.device_id
           and public.v2_is_family_guardian(child.family_id)
    )
);

create policy v2_guardians_read_own_monitoring_alerts
on public.v2_monitoring_alert_deliveries for select
to authenticated
using (guardian_user_id = auth.uid());

create policy v2_guardians_manage_own_push_endpoints
on public.v2_guardian_push_endpoints for all
to authenticated
using (guardian_user_id = auth.uid())
with check (guardian_user_id = auth.uid());

revoke all on table
    public.v2_device_monitoring_state,
    public.v2_device_monitoring_transitions,
    public.v2_monitoring_alert_deliveries,
    public.v2_guardian_push_endpoints
from public, anon;

grant select on
    public.v2_device_monitoring_state,
    public.v2_device_monitoring_transitions,
    public.v2_monitoring_alert_deliveries
to authenticated;
grant select, insert, update, delete
    on public.v2_guardian_push_endpoints
to authenticated;
grant all on
    public.v2_device_monitoring_state,
    public.v2_device_monitoring_transitions,
    public.v2_monitoring_alert_deliveries,
    public.v2_guardian_push_endpoints
to service_role;

revoke all on function public.v2_initialize_monitoring_state()
    from public, anon, authenticated;
revoke all on function public.v2_enqueue_monitoring_alerts_service(uuid)
    from public, anon, authenticated;
revoke all on function public.v2_report_device_health_v2_service(
    uuid, uuid, smallint, uuid, bigint, text, integer,
    boolean, boolean, boolean, boolean, boolean, text, text[],
    timestamptz, text, smallint, jsonb
) from public, anon, authenticated;
revoke all on function public.v2_sweep_monitoring_liveness_service(timestamptz)
    from public, anon, authenticated;

grant execute on function public.v2_report_device_health_v2_service(
    uuid, uuid, smallint, uuid, bigint, text, integer,
    boolean, boolean, boolean, boolean, boolean, text, text[],
    timestamptz, text, smallint, jsonb
) to service_role;
grant execute on function public.v2_initialize_monitoring_state()
    to service_role;
grant execute on function public.v2_enqueue_monitoring_alerts_service(uuid)
    to service_role;
grant execute on function public.v2_sweep_monitoring_liveness_service(timestamptz)
    to service_role;

select cron.schedule(
    'kippy-v2-monitoring-liveness',
    '* * * * *',
    $cron$select public.v2_sweep_monitoring_liveness_service(now());$cron$
);

commit;
