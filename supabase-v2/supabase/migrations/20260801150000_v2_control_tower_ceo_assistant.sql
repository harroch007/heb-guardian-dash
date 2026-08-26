begin;

-- Private CEO lane and unified parental-control projections. This migration
-- depends on the canonical V2 parental migrations and CT-R0 foundation.

insert into public.v2_staff_permissions(permission_key, risk_class, description)
values
    ('parental_controls.read.masked', 'r0_sensitive',
     'Read masked parental-control operational projection'),
    ('executive.private.read', 'r0_sensitive',
     'Read private aggregate executive operations summary'),
    ('executive.change_task.propose', 'r1_internal',
     'Create a CEO-owned Codex change-task proposal'),
    ('executive.change_task.approve', 'r2',
     'Approve or cancel a CEO-owned Codex change-task proposal')
on conflict (permission_key) do nothing;

insert into public.v2_staff_role_permissions(role_key, permission_key)
select 'ceo', permission_key
  from unnest(array[
      'parental_controls.read.masked',
      'executive.private.read',
      'executive.change_task.propose',
      'executive.change_task.approve'
  ]) permission(permission_key)
on conflict (role_key, permission_key) do nothing;

insert into public.v2_staff_role_permissions(role_key, permission_key)
select role_key, 'parental_controls.read.masked'
  from unnest(array['support_manager', 'device_support']) role(role_key)
on conflict (role_key, permission_key) do nothing;

insert into public.v2_admin_principals(
    id, principal_type, principal_key, display_name, environment, status
)
values (
    'c1000000-0000-4000-8000-000000000007', 'agent',
    'control_tower.ceo_assistant', 'Private CEO Assistant',
    'staging', 'shadow'
)
on conflict (environment, principal_key) do nothing;

insert into public.v2_agent_identities(
    principal_id, agent_kind, domain_key, agent_version,
    tool_allowlist, sponsor_required
)
values (
    'c1000000-0000-4000-8000-000000000007', 'internal_copilot',
    'executive_private', 'ct-ceo-assistant-v1',
    array[
        'executive_operational_summary', 'installation_status',
        'device_health', 'parental_controls_status',
        'safety_parent_safe', 'action_lifecycle', 'audit_summary'
    ],
    true
)
on conflict (principal_id) do update set
    agent_version = excluded.agent_version,
    tool_allowlist = excluded.tool_allowlist,
    sponsor_required = true;

create or replace function public.v2_admin_ceo_path_array_is_safe(
    target_value text[],
    target_max_items integer default 32
)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(
        target_value is not null
        and cardinality(target_value) between 1 and target_max_items
        and not exists (
            select 1
              from unnest(target_value) item(value)
             where char_length(item.value) not between 1 and 240
                or item.value !~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$'
                or item.value like '%..%'
                or item.value like '/%'
                or item.value ~ '(^|/)\.{1,2}(/|$)'
        ),
        false
    );
$$;

create table public.v2_admin_ceo_change_tasks (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (environment = 'staging'),
    owner_principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    idempotency_key text not null check (
        idempotency_key ~ '^[A-Za-z0-9_.:-]{8,200}$'
    ),
    request_fingerprint text not null check (
        request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
    title text not null check (
        char_length(title) between 1 and 160 and title !~ E'[\r\n]'
    ),
    objective_summary text not null check (
        char_length(objective_summary) between 1 and 2000
        and objective_summary !~ E'[\r\n]'
    ),
    repository_key text not null check (
        repository_key ~ '^[A-Za-z0-9_.:-]{2,120}$'
    ),
    allowed_path_scopes text[] not null check (
        public.v2_admin_ceo_path_array_is_safe(allowed_path_scopes, 32)
    ),
    required_check_codes text[] not null default '{}' check (
        public.v2_admin_shadow_string_array_is_safe(
            to_jsonb(required_check_codes), 32, 120
        )
    ),
    aggregate_context_refs text[] not null default '{}' check (
        public.v2_admin_shadow_string_array_is_safe(
            to_jsonb(aggregate_context_refs), 64, 240
        )
    ),
    contains_raw_child_content boolean not null default false
        check (not contains_raw_child_content),
    status text not null default 'proposed'
        constraint v2_admin_ceo_change_tasks_status_check check (status in (
        'draft', 'proposed', 'approved', 'claimed', 'running',
        'validation_failed', 'ready_for_review', 'completed',
        'failed', 'cancelled'
    )),
    execution_path text not null default 'trusted_external_runner'
        check (execution_path = 'trusted_external_runner'),
    isolated_worktree_required boolean not null default true
        check (isolated_worktree_required),
    pull_request_required boolean not null default true
        check (pull_request_required),
    tests_required boolean not null default true check (tests_required),
    human_approval_required boolean not null default true
        check (human_approval_required),
    direct_repository_write boolean not null default false
        check (not direct_repository_write),
    direct_merge boolean not null default false check (not direct_merge),
    direct_deployment boolean not null default false
        check (not direct_deployment),
    runner_state text not null default 'not_configured' check (
        runner_state in ('not_configured', 'available', 'offline', 'revoked')
    ),
    approved_by_principal_id uuid
        references public.v2_admin_principals(id) on delete restrict,
    approved_at timestamptz,
    claimed_by_runner_key text check (
        claimed_by_runner_key is null
        or claimed_by_runner_key ~ '^[A-Za-z0-9_.:-]{3,120}$'
    ),
    claimed_at timestamptz,
    started_at timestamptz,
    finished_at timestamptz,
    safe_result_code text check (
        safe_result_code is null
        or safe_result_code ~ '^[A-Za-z0-9_.:-]{2,120}$'
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (owner_principal_id, idempotency_key),
    check (
        (status in ('approved', 'claimed', 'running', 'validation_failed',
                    'ready_for_review', 'completed', 'failed')
         and approved_by_principal_id is not null and approved_at is not null)
        or status in ('draft', 'proposed', 'cancelled')
    ),
    check (
        (status in ('claimed', 'running', 'validation_failed',
                    'ready_for_review', 'completed', 'failed'))
        = (claimed_by_runner_key is not null and claimed_at is not null)
    )
);

create index v2_admin_ceo_change_tasks_status
    on public.v2_admin_ceo_change_tasks(
        environment, status, created_at desc, id desc
    );

create trigger v2_admin_ceo_change_tasks_set_updated_at
before update on public.v2_admin_ceo_change_tasks
for each row execute function public.v2_set_updated_at();

alter table public.v2_admin_ceo_change_tasks enable row level security;
alter table public.v2_admin_ceo_change_tasks force row level security;
revoke all on table public.v2_admin_ceo_change_tasks
from public, anon, authenticated, service_role;

create or replace function public.v2_admin_is_current_ceo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from public.v2_staff_role_assignments assignment
         where assignment.staff_principal_id =
               public.v2_admin_current_staff_principal()
           and assignment.environment = 'staging'
           and assignment.role_key = 'ceo'
           and assignment.scope_type = 'global'
           and assignment.valid_from <= now()
           and (
               assignment.expires_at is null
               or assignment.expires_at > now()
           )
    );
$$;

create or replace function public.v2_admin_get_parental_controls_projection(
    target_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    admin_case public.v2_admin_cases%rowtype;
    desired_revision bigint;
    applied_revision bigint;
    result_data jsonb;
    audit_id bigint;
begin
    if not public.v2_admin_can_read_case(
        target_case_id, 'parental_controls.read.masked'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'parental_controls_projection',
            target_case_id, 'parental_controls_review',
            'permission_denied', array['parental_controls_status']
        );
    end if;

    select * into admin_case
      from public.v2_admin_cases admin_case_row
     where admin_case_row.id = target_case_id;

    if admin_case.child_id is null then
        result_data := jsonb_build_object(
            'availability', 'REQUIRES_PROJECTION',
            'reason_code', 'case_child_not_linked'
        );
    else
        select settings.revision into desired_revision
          from public.v2_parental_settings settings
         where settings.child_id = admin_case.child_id;
        select state.settings_revision_applied into applied_revision
          from public.v2_parental_device_state state
          join public.v2_protected_devices device
            on device.id = state.device_id
         where device.child_id = admin_case.child_id
         order by state.received_at desc
         limit 1;

        result_data := jsonb_build_object(
            'availability', 'EXISTING_V2',
            'child_linked', true,
            'desired_revision', desired_revision,
            'applied_revision', applied_revision,
            'sync_state', case
                when desired_revision is null or applied_revision is null
                    then 'unknown'
                when desired_revision = applied_revision then 'in_sync'
                when desired_revision > applied_revision then 'device_behind'
                else 'device_ahead'
            end,
            'settings', (
                select jsonb_build_object(
                    'daily_screen_time_limit_minutes',
                        settings.daily_screen_time_limit_minutes,
                    'location_tracking_enabled',
                        settings.location_tracking_enabled,
                    'location_update_interval_minutes',
                        settings.location_update_interval_minutes,
                    'home_exit_alert_enabled',
                        settings.home_exit_alert_enabled,
                    'school_exit_alert_enabled',
                        settings.school_exit_alert_enabled,
                    'exit_debounce_seconds', settings.exit_debounce_seconds,
                    'lost_mode_enabled', settings.lost_mode_enabled,
                    'updated_at', settings.updated_at
                )
                  from public.v2_parental_settings settings
                 where settings.child_id = admin_case.child_id
            ),
            'policy_counts', jsonb_build_object(
                'approved', (
                    select count(*)
                      from public.v2_parental_app_policies policy
                     where policy.child_id = admin_case.child_id
                       and policy.policy_status = 'approved'
                ),
                'blocked', (
                    select count(*)
                      from public.v2_parental_app_policies policy
                     where policy.child_id = admin_case.child_id
                       and policy.policy_status = 'blocked'
                ),
                'limited', (
                    select count(*)
                      from public.v2_parental_app_policies policy
                     where policy.child_id = admin_case.child_id
                       and policy.daily_limit_minutes is not null
                )
            ),
            'schedule_counts', jsonb_build_object(
                'active', (
                    select count(*)
                      from public.v2_parental_schedules schedule
                     where schedule.child_id = admin_case.child_id
                       and schedule.is_active
                ),
                'shabbat', (
                    select count(*)
                      from public.v2_parental_schedules schedule
                     where schedule.child_id = admin_case.child_id
                       and schedule.is_active
                       and schedule.schedule_type = 'shabbat'
                )
            ),
            'geofence_counts', jsonb_build_object(
                'active', (
                    select count(*)
                      from public.v2_parental_geofences geofence
                     where geofence.child_id = admin_case.child_id
                       and geofence.is_active
                ),
                'events_last_7_days', (
                    select count(*)
                      from public.v2_parental_geofence_events event
                      join public.v2_protected_devices device
                        on device.id = event.device_id
                     where device.child_id = admin_case.child_id
                       and event.occurred_at >= now() - interval '7 days'
                )
            ),
            'device_state', (
                select jsonb_build_object(
                    'settings_revision_applied',
                        state.settings_revision_applied,
                    'usage_date', state.usage_date,
                    'total_screen_minutes', state.total_screen_minutes,
                    'location_available',
                        state.latitude is not null
                        and state.longitude is not null,
                    'location_observed_at', state.location_observed_at,
                    'observed_at', state.observed_at,
                    'received_at', state.received_at
                )
                  from public.v2_parental_device_state state
                  join public.v2_protected_devices device
                    on device.id = state.device_id
                 where device.child_id = admin_case.child_id
                 order by state.received_at desc
                 limit 1
            ),
            'installed_apps', jsonb_build_object(
                'installed_count', (
                    select count(*)
                      from public.v2_parental_installed_apps app
                      join public.v2_protected_devices device
                        on device.id = app.device_id
                     where device.child_id = admin_case.child_id
                       and app.is_installed
                ),
                'last_snapshot_at', (
                    select max(app.last_seen_at)
                      from public.v2_parental_installed_apps app
                      join public.v2_protected_devices device
                        on device.id = app.device_id
                     where device.child_id = admin_case.child_id
                )
            ),
            'usage_today', jsonb_build_object(
                'total_minutes', coalesce((
                    select sum(usage.usage_minutes)
                      from public.v2_parental_app_usage_daily usage
                      join public.v2_protected_devices device
                        on device.id = usage.device_id
                     where device.child_id = admin_case.child_id
                       and usage.usage_date =
                           (now() at time zone 'Asia/Jerusalem')::date
                ), 0),
                'app_count', (
                    select count(*)
                      from public.v2_parental_app_usage_daily usage
                      join public.v2_protected_devices device
                        on device.id = usage.device_id
                     where device.child_id = admin_case.child_id
                       and usage.usage_date =
                           (now() at time zone 'Asia/Jerusalem')::date
                )
            ),
            'blocked_attempts', jsonb_build_object(
                'last_7_days', (
                    select count(*)
                      from public.v2_parental_blocked_attempts attempt
                      join public.v2_protected_devices device
                        on device.id = attempt.device_id
                     where device.child_id = admin_case.child_id
                       and attempt.attempted_at >= now() - interval '7 days'
                ),
                'last_attempted_at', (
                    select max(attempt.attempted_at)
                      from public.v2_parental_blocked_attempts attempt
                      join public.v2_protected_devices device
                        on device.id = attempt.device_id
                     where device.child_id = admin_case.child_id
                )
            ),
            'excluded_domains', jsonb_build_array(
                'child_time_request_workflow', 'raw_child_content'
            )
        );
    end if;

    audit_id := public.v2_admin_write_audit_event(
        'parental_controls.masked_read', 'success', target_case_id, null,
        'parental_controls_projection', target_case_id,
        'parental_controls_review', array['parental_controls_status'],
        null, gen_random_uuid(),
        jsonb_build_object('aggregate_only', true)
    );
    return jsonb_build_object(
        'schema_version', 1,
        'generated_at', now(),
        'source_mode', admin_case.source_mode,
        'data', result_data,
        'page', null,
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_get_executive_operational_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    audit_id bigint;
    result_data jsonb;
begin
    if not public.v2_admin_is_current_ceo()
       or not public.v2_admin_has_permission('executive.private.read') then
        raise exception 'ceo_private_access_required'
            using errcode = '42501';
    end if;

    result_data := jsonb_build_object(
        'case_counts_by_status', coalesce((
            select jsonb_object_agg(status, count_value)
              from (
                  select admin_case.status, count(*) count_value
                    from public.v2_admin_cases admin_case
                   where admin_case.environment = 'staging'
                   group by admin_case.status
              ) counts
        ), '{}'::jsonb),
        'case_counts_by_priority', coalesce((
            select jsonb_object_agg(priority, count_value)
              from (
                  select admin_case.priority, count(*) count_value
                    from public.v2_admin_cases admin_case
                   where admin_case.environment = 'staging'
                   group by admin_case.priority
              ) counts
        ), '{}'::jsonb),
        'device_counts_by_status', coalesce((
            select jsonb_object_agg(status, count_value)
              from (
                  select device.status, count(*) count_value
                    from public.v2_protected_devices device
                   group by device.status
              ) counts
        ), '{}'::jsonb),
        'monitoring_counts_by_state', coalesce((
            select jsonb_object_agg(monitoring_state, count_value)
              from (
                  select state.monitoring_state, count(*) count_value
                    from public.v2_device_monitoring_state state
                   group by state.monitoring_state
              ) counts
        ), '{}'::jsonb),
        'parental_controls', jsonb_build_object(
            'configured_children', (
                select count(*) from public.v2_parental_settings
            ),
            'active_schedules', (
                select count(*) from public.v2_parental_schedules
                 where is_active
            ),
            'active_geofences', (
                select count(*) from public.v2_parental_geofences
                 where is_active
            ),
            'blocked_attempts_last_24h', (
                select count(*) from public.v2_parental_blocked_attempts
                 where attempted_at >= now() - interval '24 hours'
            )
        ),
        'agent_runtime', jsonb_build_object(
            'runs_last_24h', (
                select count(*) from public.v2_admin_agent_runs
                 where created_at >= now() - interval '24 hours'
            ),
            'failed_closed_last_24h', (
                select count(*) from public.v2_admin_agent_evaluations
                 where created_at >= now() - interval '24 hours'
                   and outcome = 'failed_closed'
            ),
            'dead_letter_jobs', (
                select count(*) from public.v2_admin_shadow_jobs
                 where status = 'dead_letter'
            )
        ),
        'change_tasks_by_status', coalesce((
            select jsonb_object_agg(status, count_value)
              from (
                  select task.status, count(*) count_value
                    from public.v2_admin_ceo_change_tasks task
                   where task.environment = 'staging'
                   group by task.status
              ) counts
        ), '{}'::jsonb),
        'runner_state', 'not_configured',
        'privacy_boundary', jsonb_build_object(
            'aggregate_only', true,
            'raw_child_content', false,
            'customer_channel', false
        )
    );

    audit_id := public.v2_admin_write_audit_event(
        'executive.private_summary_read', 'success', null, null,
        'executive_summary', null, 'executive_operating_review',
        array['aggregate_operational_metrics'], null,
        gen_random_uuid(), jsonb_build_object('aggregate_only', true)
    );
    return jsonb_build_object(
        'schema_version', 1,
        'generated_at', now(),
        'source_mode', 'staging',
        'data', result_data,
        'page', null,
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_create_ceo_change_task(
    target_idempotency_key text,
    target_title text,
    target_objective_summary text,
    target_repository_key text,
    target_allowed_path_scopes text[],
    target_required_check_codes text[],
    target_aggregate_context_refs text[],
    target_contains_raw_child_content boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_id uuid;
    task_id uuid;
    existing_fingerprint text;
    request_fingerprint text;
    audit_id bigint;
begin
    owner_id := public.v2_admin_current_staff_principal();
    if owner_id is null or not public.v2_admin_is_current_ceo()
       or not public.v2_admin_has_permission(
           'executive.change_task.propose'
       ) then
        raise exception 'ceo_private_access_required'
            using errcode = '42501';
    end if;
    if target_contains_raw_child_content is distinct from false
       or target_idempotency_key !~ '^[A-Za-z0-9_.:-]{8,200}$'
       or target_repository_key !~ '^[A-Za-z0-9_.:-]{2,120}$'
       or char_length(target_title) not between 1 and 160
       or target_title ~ E'[\r\n]'
       or char_length(target_objective_summary) not between 1 and 2000
       or target_objective_summary ~ E'[\r\n]'
       or not public.v2_admin_ceo_path_array_is_safe(
           target_allowed_path_scopes, 32
       )
       or not public.v2_admin_shadow_string_array_is_safe(
           to_jsonb(coalesce(target_required_check_codes, '{}')), 32, 120
       )
       or not public.v2_admin_shadow_string_array_is_safe(
           to_jsonb(coalesce(target_aggregate_context_refs, '{}')), 64, 240
       ) then
        raise exception 'invalid_ceo_change_task'
            using errcode = '22023';
    end if;

    request_fingerprint := encode(extensions.digest(convert_to(
        concat_ws('|', target_title, target_objective_summary,
                  target_repository_key,
                  array_to_string(target_allowed_path_scopes, ','),
                  array_to_string(coalesce(target_required_check_codes, '{}'), ','),
                  array_to_string(coalesce(target_aggregate_context_refs, '{}'), ',')),
        'UTF8'
    ), 'sha256'), 'hex');

    select task.id, task.request_fingerprint
      into task_id, existing_fingerprint
      from public.v2_admin_ceo_change_tasks task
     where task.owner_principal_id = owner_id
       and task.idempotency_key = target_idempotency_key;
    if found then
        if existing_fingerprint <> request_fingerprint then
            raise exception 'ceo_change_task_idempotency_conflict'
                using errcode = '23505';
        end if;
        return jsonb_build_object(
            'schema_version', 1, 'duplicate', true,
            'task_id', task_id, 'status', (
                select status from public.v2_admin_ceo_change_tasks
                 where id = task_id
            )
        );
    end if;

    insert into public.v2_admin_ceo_change_tasks(
        environment, owner_principal_id, idempotency_key,
        request_fingerprint, title, objective_summary, repository_key,
        allowed_path_scopes, required_check_codes,
        aggregate_context_refs, contains_raw_child_content,
        status, runner_state
    ) values (
        'staging', owner_id, target_idempotency_key,
        request_fingerprint, target_title, target_objective_summary,
        target_repository_key, target_allowed_path_scopes,
        coalesce(target_required_check_codes, '{}'),
        coalesce(target_aggregate_context_refs, '{}'), false,
        'proposed', 'not_configured'
    ) returning id into task_id;

    audit_id := public.v2_admin_write_audit_event(
        'executive.change_task_proposed', 'success', null, null,
        'ceo_change_task', task_id, 'codex_change_proposal',
        array['repository_key', 'allowed_path_scopes', 'required_checks'],
        null, gen_random_uuid(), jsonb_build_object(
            'runner_state', 'not_configured',
            'raw_child_content', false,
            'direct_repository_write', false
        )
    );
    return jsonb_build_object(
        'schema_version', 1, 'duplicate', false,
        'task_id', task_id, 'status', 'proposed',
        'runner_state', 'not_configured',
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_list_ceo_change_tasks(
    target_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_id uuid;
    result_data jsonb;
    audit_id bigint;
begin
    owner_id := public.v2_admin_current_staff_principal();
    if owner_id is null or not public.v2_admin_is_current_ceo()
       or not public.v2_admin_has_permission('executive.private.read') then
        raise exception 'ceo_private_access_required'
            using errcode = '42501';
    end if;
    if target_limit not between 1 and 100 then
        raise exception 'invalid_ceo_change_task_limit'
            using errcode = '22023';
    end if;

    select coalesce(jsonb_agg(item.payload order by item.created_at desc), '[]'::jsonb)
      into result_data
      from (
          select task.created_at,
                 jsonb_build_object(
                     'task_id', task.id,
                     'title', task.title,
                     'objective_summary', task.objective_summary,
                     'repository_key', task.repository_key,
                     'allowed_path_scopes', task.allowed_path_scopes,
                     'required_check_codes', task.required_check_codes,
                     'aggregate_context_refs', task.aggregate_context_refs,
                     'status', task.status,
                     'runner_state', task.runner_state,
                     'execution_path', task.execution_path,
                     'human_approval_required',
                         task.human_approval_required,
                     'isolated_worktree_required',
                         task.isolated_worktree_required,
                     'pull_request_required', task.pull_request_required,
                     'tests_required', task.tests_required,
                     'safe_result_code', task.safe_result_code,
                     'approved_at', task.approved_at,
                     'created_at', task.created_at,
                     'updated_at', task.updated_at
                 ) payload
            from public.v2_admin_ceo_change_tasks task
           where task.owner_principal_id = owner_id
             and task.environment = 'staging'
           order by task.created_at desc
           limit target_limit
      ) item;

    audit_id := public.v2_admin_write_audit_event(
        'executive.change_task_list_read', 'success', null, null,
        'ceo_change_task', null, 'executive_operating_review',
        array['change_task_status'], null, gen_random_uuid(),
        jsonb_build_object('result_count', jsonb_array_length(result_data))
    );
    return jsonb_build_object(
        'schema_version', 1,
        'generated_at', now(),
        'source_mode', 'staging',
        'data', result_data,
        'page', jsonb_build_object('limit', target_limit),
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_approve_ceo_change_task(
    target_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_id uuid;
    audit_id bigint;
begin
    owner_id := public.v2_admin_current_staff_principal();
    if owner_id is null or not public.v2_admin_is_current_ceo()
       or not public.v2_admin_has_permission(
           'executive.change_task.approve'
       ) then
        raise exception 'ceo_private_access_required'
            using errcode = '42501';
    end if;
    update public.v2_admin_ceo_change_tasks task
       set status = 'approved',
           approved_by_principal_id = owner_id,
           approved_at = now()
     where task.id = target_task_id
       and task.owner_principal_id = owner_id
       and task.status = 'proposed';
    if not found then
        raise exception 'ceo_change_task_not_approvable'
            using errcode = '55000';
    end if;
    audit_id := public.v2_admin_write_audit_event(
        'executive.change_task_approved', 'success', null, null,
        'ceo_change_task', target_task_id, 'codex_change_approval',
        array['status'], null, gen_random_uuid(),
        jsonb_build_object(
            'runner_state', 'not_configured',
            'external_runner_required', true
        )
    );
    return jsonb_build_object(
        'schema_version', 1, 'task_id', target_task_id,
        'status', 'approved', 'runner_state', 'not_configured',
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_cancel_ceo_change_task(
    target_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    owner_id uuid;
    audit_id bigint;
begin
    owner_id := public.v2_admin_current_staff_principal();
    if owner_id is null or not public.v2_admin_is_current_ceo()
       or not public.v2_admin_has_permission(
           'executive.change_task.approve'
       ) then
        raise exception 'ceo_private_access_required'
            using errcode = '42501';
    end if;
    update public.v2_admin_ceo_change_tasks task
       set status = 'cancelled'
     where task.id = target_task_id
       and task.owner_principal_id = owner_id
       and task.status in ('draft', 'proposed', 'approved');
    if not found then
        raise exception 'ceo_change_task_not_cancellable'
            using errcode = '55000';
    end if;
    audit_id := public.v2_admin_write_audit_event(
        'executive.change_task_cancelled', 'success', null, null,
        'ceo_change_task', target_task_id, 'codex_change_cancellation',
        array['status'], null, gen_random_uuid(), '{}'::jsonb
    );
    return jsonb_build_object(
        'schema_version', 1, 'task_id', target_task_id,
        'status', 'cancelled', 'audit_event_id', audit_id
    );
end;
$$;

revoke all on function public.v2_admin_is_current_ceo()
from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_ceo_path_array_is_safe(text[], integer)
from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_get_parental_controls_projection(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_get_executive_operational_summary()
from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_create_ceo_change_task(
    text, text, text, text, text[], text[], text[], boolean
) from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_list_ceo_change_tasks(integer)
from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_approve_ceo_change_task(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.v2_admin_cancel_ceo_change_task(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.v2_admin_get_parental_controls_projection(uuid)
to authenticated;
grant execute on function public.v2_admin_get_executive_operational_summary()
to authenticated;
grant execute on function public.v2_admin_create_ceo_change_task(
    text, text, text, text, text[], text[], text[], boolean
) to authenticated;
grant execute on function public.v2_admin_list_ceo_change_tasks(integer)
to authenticated;
grant execute on function public.v2_admin_approve_ceo_change_task(uuid)
to authenticated;
grant execute on function public.v2_admin_cancel_ceo_change_task(uuid)
to authenticated;

comment on table public.v2_admin_ceo_change_tasks is
    'CEO-owned audited change proposals. No Supabase/browser path executes Codex or writes a repository.';
comment on function public.v2_admin_get_parental_controls_projection(uuid) is
    'Masked aggregate over canonical V2 parental controls. Excludes child time requests and raw child content.';

commit;
