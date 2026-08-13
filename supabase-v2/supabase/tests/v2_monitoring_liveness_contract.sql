\set ON_ERROR_STOP on

begin;

insert into auth.users (id)
values ('11000000-0000-0000-0000-000000000001');

insert into public.v2_families (id, display_name)
values ('21000000-0000-0000-0000-000000000001', 'Monitoring family');

insert into public.v2_guardian_memberships (
    family_id,
    guardian_user_id,
    role,
    status
)
values (
    '21000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name)
values (
    '31000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    'Monitoring child'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
)
values (
    '41000000-0000-4000-8000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    '2.0.0-test',
    'active'
);

do $$
declare
    first_result record;
    duplicate_result record;
    stale_result record;
    transition_count integer;
    observed_time timestamptz := date_trunc('second', now());
begin
    select *
      into first_result
      from public.v2_report_device_health_v2_service(
          '41000000-0000-4000-8000-000000000001',
          '61000000-0000-4000-8000-000000000001',
          2::smallint,
          '71000000-0000-4000-8000-000000000001',
          1,
          'runtime_started',
          120,
          true,
          true,
          true,
          true,
          true,
          'confirmed',
          '{}'::text[],
          observed_time,
          '2.0.0-test',
          80::smallint,
          '{"accessibility_enabled":{"state":"satisfied"}}'::jsonb
      );

    if not first_result.accepted
       or first_result.duplicate
       or not first_result.affects_current_state
       or first_result.monitoring_state <> 'protected' then
        raise exception 'First heartbeat contract failed: %', first_result;
    end if;

    select *
      into duplicate_result
      from public.v2_report_device_health_v2_service(
          '41000000-0000-4000-8000-000000000001',
          '61000000-0000-4000-8000-000000000001',
          2::smallint,
          '71000000-0000-4000-8000-000000000001',
          1,
          'runtime_started',
          120,
          true,
          true,
          true,
          true,
          true,
          'confirmed',
          '{}'::text[],
          observed_time,
          '2.0.0-test',
          80::smallint,
          '{"accessibility_enabled":{"state":"satisfied"}}'::jsonb
      );

    if duplicate_result.accepted
       or not duplicate_result.duplicate then
        raise exception 'Duplicate heartbeat contract failed: %',
            duplicate_result;
    end if;

    select *
      into stale_result
      from public.v2_report_device_health_v2_service(
          '41000000-0000-4000-8000-000000000001',
          '61000000-0000-4000-8000-000000000002',
          2::smallint,
          '71000000-0000-4000-8000-000000000001',
          2,
          'periodic',
          120,
          true,
          true,
          true,
          true,
          true,
          'confirmed',
          '{}'::text[],
          now() - interval '20 minutes',
          '2.0.0-test',
          79::smallint,
          '{"accessibility_enabled":{"state":"satisfied"}}'::jsonb
      );

    if not stale_result.accepted
       or stale_result.affects_current_state then
        raise exception 'Out-of-order heartbeat changed state: %',
            stale_result;
    end if;

    select count(*)
      into transition_count
      from public.v2_device_monitoring_transitions
     where device_id = '41000000-0000-4000-8000-000000000001';
    if transition_count <> 1 then
        raise exception 'Unexpected transition count: %', transition_count;
    end if;
end
$$;

update public.v2_device_monitoring_state
   set late_after_at = now() - interval '2 minutes',
       interrupted_after_at = now() - interval '1 minute'
 where device_id = '41000000-0000-4000-8000-000000000001';

select public.v2_sweep_monitoring_liveness_service(now());

do $$
declare
    state_value text;
    interruption_alerts integer;
begin
    select monitoring_state
      into state_value
      from public.v2_device_monitoring_state
     where device_id = '41000000-0000-4000-8000-000000000001';
    if state_value <> 'interrupted' then
        raise exception 'Sweeper failed: %', state_value;
    end if;

    select count(*)
      into interruption_alerts
      from public.v2_monitoring_alert_deliveries
     where alert_type = 'monitoring_interrupted';
    if interruption_alerts <> 1 then
        raise exception 'Interruption alert count: %', interruption_alerts;
    end if;
end
$$;

select *
from public.v2_report_device_health_v2_service(
    '41000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000003',
    2::smallint,
    '71000000-0000-4000-8000-000000000001',
    3,
    'periodic',
    120,
    true,
    true,
    true,
    true,
    true,
    'confirmed',
    '{}'::text[],
    now(),
    '2.0.0-test',
    78::smallint,
    '{"accessibility_enabled":{"state":"satisfied"}}'::jsonb
);

select *
from public.v2_report_device_health_v2_service(
    '41000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000004',
    2::smallint,
    '71000000-0000-4000-8000-000000000001',
    4,
    'periodic',
    120,
    true,
    true,
    true,
    true,
    true,
    'confirmed',
    '{}'::text[],
    now(),
    '2.0.0-test',
    77::smallint,
    '{"accessibility_enabled":{"state":"satisfied"}}'::jsonb
);

do $$
declare
    state_value text;
    restored_alerts integer;
begin
    select monitoring_state
      into state_value
      from public.v2_device_monitoring_state
     where device_id = '41000000-0000-4000-8000-000000000001';
    if state_value <> 'protected' then
        raise exception 'Recovery contract failed: %', state_value;
    end if;

    select count(*)
      into restored_alerts
      from public.v2_monitoring_alert_deliveries
     where alert_type = 'monitoring_restored';
    if restored_alerts <> 1 then
        raise exception 'Restoration alert count: %', restored_alerts;
    end if;
end
$$;

-- A device already reporting a broken capability must still progress to
-- interrupted if heartbeats stop. Otherwise uninstall/offline detection would
-- be permanently hidden behind the earlier action_required state.
select *
from public.v2_report_device_health_v2_service(
    '41000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000005',
    2::smallint,
    '71000000-0000-4000-8000-000000000001',
    5,
    'capability_changed',
    120,
    false,
    false,
    false,
    true,
    true,
    'confirmed',
    array['accessibility_enabled'],
    now(),
    '2.0.0-test',
    76::smallint,
    '{"accessibility_enabled":{"state":"missing"}}'::jsonb
);

update public.v2_device_monitoring_state
   set late_after_at = now() - interval '2 minutes',
       interrupted_after_at = now() - interval '1 minute'
 where device_id = '41000000-0000-4000-8000-000000000001';

select public.v2_sweep_monitoring_liveness_service(now());

do $$
declare
    state_value text;
    interruption_alerts integer;
begin
    select monitoring_state
      into state_value
      from public.v2_device_monitoring_state
     where device_id = '41000000-0000-4000-8000-000000000001';
    if state_value <> 'interrupted' then
        raise exception 'Action-required timeout was hidden: %', state_value;
    end if;

    select count(*)
      into interruption_alerts
      from public.v2_monitoring_alert_deliveries
     where alert_type = 'monitoring_interrupted';
    if interruption_alerts <> 2 then
        raise exception 'Second interruption alert count: %',
            interruption_alerts;
    end if;
end
$$;

rollback;
