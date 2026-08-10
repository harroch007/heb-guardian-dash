begin;

-- Staging-only persistence for the deterministic CT agent kernel.  This layer
-- stores proposals and audit evidence only.  It has no dispatcher, decryptor,
-- model client, tool executor, outbound channel, or product/device mutation.

insert into public.v2_admin_principals(
    id, principal_type, principal_key, display_name, environment, status
)
values (
    'c1000000-0000-4000-8000-000000000006', 'service',
    'control_tower.shadow_runtime', 'Control Tower Shadow Runtime',
    'staging', 'active'
)
on conflict (environment, principal_key) do nothing;

insert into public.v2_agent_identities(
    principal_id, agent_kind, domain_key, agent_version,
    tool_allowlist, sponsor_required
)
values (
    'c1000000-0000-4000-8000-000000000006', 'workflow_service',
    'shadow_runtime', 'ct-shadow-runtime-v1', '{}', false
)
on conflict (principal_id) do nothing;

alter table public.v2_admin_shadow_jobs
    drop constraint if exists v2_admin_shadow_jobs_status_check;

update public.v2_admin_shadow_jobs
   set status = 'failed_retryable'
 where status = 'failed';

alter table public.v2_admin_shadow_jobs
    add column attempt_count integer not null default 0,
    add column max_attempts integer not null default 3,
    add column not_before timestamptz not null default now(),
    add column leased_by text,
    add column lease_token uuid,
    add column leased_at timestamptz,
    add column lease_expires_at timestamptz,
    add column last_failure_code text,
    add column last_failed_at timestamptz,
    add column completed_at timestamptz,
    add column dead_lettered_at timestamptz,
    add column safe_input_envelope jsonb,
    add column safe_input_idempotency_key text,
    add column safe_input_attached_at timestamptz;

-- Pre-runtime rows had no real lease metadata or terminal timestamps.  A
-- legacy "leased" value therefore cannot represent an owned lease and is
-- safely returned to pending; already completed rows retain their outcome.
update public.v2_admin_shadow_jobs
   set status = 'pending'
 where status = 'leased';
update public.v2_admin_shadow_jobs
   set completed_at = coalesce(updated_at, created_at, now())
 where status = 'completed';

alter table public.v2_admin_shadow_jobs
    add constraint v2_admin_shadow_jobs_status_check check (
        status in (
            'pending', 'leased', 'completed', 'failed_retryable',
            'dead_letter', 'cancelled'
        )
    ),
    add constraint v2_admin_shadow_jobs_attempt_check check (
        attempt_count >= 0 and max_attempts between 1 and 10
        and attempt_count <= max_attempts
    ),
    add constraint v2_admin_shadow_jobs_lease_check check (
        (
            status = 'leased'
            and leased_by is not null
            and lease_token is not null
            and leased_at is not null
            and lease_expires_at > leased_at
        )
        or (
            status <> 'leased'
            and leased_by is null
            and lease_token is null
            and leased_at is null
            and lease_expires_at is null
        )
    ),
    add constraint v2_admin_shadow_jobs_terminal_check check (
        (status = 'completed') = (completed_at is not null)
        and (status = 'dead_letter') = (dead_lettered_at is not null)
    ),
    add constraint v2_admin_shadow_jobs_safe_input_key_check check (
        safe_input_idempotency_key is null
        or safe_input_idempotency_key ~ '^[A-Za-z0-9_.:-]{8,200}$'
    ),
    add constraint v2_admin_shadow_jobs_safe_input_shape_check check (
        safe_input_envelope is null
        or jsonb_typeof(safe_input_envelope) = 'object'
    );

create unique index v2_admin_shadow_jobs_safe_input_idempotency
    on public.v2_admin_shadow_jobs(safe_input_idempotency_key)
    where safe_input_idempotency_key is not null;

drop index if exists public.v2_admin_shadow_jobs_pending;
create index v2_admin_shadow_jobs_runnable
    on public.v2_admin_shadow_jobs(
        environment, not_before, created_at, id
    )
    where status in ('pending', 'failed_retryable');
create index v2_admin_shadow_jobs_expired_lease
    on public.v2_admin_shadow_jobs(environment, lease_expires_at, id)
    where status = 'leased';

create table public.v2_admin_agent_versions (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (environment = 'staging'),
    agent_id text not null check (agent_id in (
        'front_office', 'internal_operations', 'support', 'installation',
        'device_fleet', 'parental_controls', 'billing_finance', 'privacy',
        'safety', 'security', 'growth', 'release', 'executive'
    )),
    agent_version text not null check (
        agent_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
    ),
    contract_version text not null check (
        contract_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
    ),
    registry_version text not null check (
        registry_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
    ),
    orchestrator_version text not null check (
        orchestrator_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
    ),
    implementation_digest text not null check (
        implementation_digest ~ '^[0-9a-f]{64}$'
    ),
    execution_mode text not null check (execution_mode = 'offline_shadow'),
    effect_mode text not null check (effect_mode = 'proposals_only'),
    created_at timestamptz not null default now(),
    unique (
        environment, agent_id, agent_version, contract_version,
        registry_version, orchestrator_version
    )
);

create table public.v2_admin_agent_runs (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (environment = 'staging'),
    job_id uuid not null unique
        references public.v2_admin_shadow_jobs(id) on delete restrict,
    case_id uuid not null
        references public.v2_admin_cases(id) on delete restrict,
    agent_version_id uuid not null
        references public.v2_admin_agent_versions(id) on delete restrict,
    run_key text not null unique check (
        run_key ~ '^[A-Za-z0-9_.:-]{8,240}$'
    ),
    correlation_id uuid not null,
    input_state text not null check (
        input_state in ('parent_safe', 'insufficient_evidence')
    ),
    status text not null check (
        status in ('completed_shadow', 'routed_to_human')
    ),
    decision_code text not null check (
        decision_code ~ '^[a-z0-9_.:-]{2,120}$'
    ),
    routing_payload jsonb not null,
    result_payload jsonb not null,
    model_used boolean not null check (not model_used),
    network_used boolean not null check (not network_used),
    tools_executed integer not null check (tools_executed = 0),
    mutations_applied integer not null check (mutations_applied = 0),
    outbound_messages_sent integer not null check (outbound_messages_sent = 0),
    contract_version text not null,
    registry_version text not null,
    orchestrator_version text not null,
    completed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    check (public.v2_admin_json_is_safe(routing_payload, 65536)),
    check (public.v2_admin_json_is_safe(result_payload, 262144))
);

create table public.v2_admin_agent_handoffs (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (environment = 'staging'),
    run_id uuid not null
        references public.v2_admin_agent_runs(id) on delete restrict,
    case_id uuid not null
        references public.v2_admin_cases(id) on delete restrict,
    handoff_key text not null unique check (
        handoff_key ~ '^[A-Za-z0-9_.:-]{8,240}$'
    ),
    handoff_kind text not null check (
        handoff_kind in ('agent_assignment', 'human_takeover')
    ),
    destination_kind text not null check (
        destination_kind in ('agent', 'human_queue')
    ),
    destination_key text not null check (
        destination_key ~ '^[a-z0-9_.:-]{2,120}$'
    ),
    reason_code text not null check (
        reason_code ~ '^[a-z0-9_.:-]{2,120}$'
    ),
    delivery_status text not null check (delivery_status = 'not_dispatched'),
    effect_mode text not null check (effect_mode = 'proposal_only'),
    handoff_payload jsonb not null,
    created_at timestamptz not null default now(),
    check (public.v2_admin_json_is_safe(handoff_payload, 32768))
);

create table public.v2_admin_agent_evaluations (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (environment = 'staging'),
    run_id uuid not null unique
        references public.v2_admin_agent_runs(id) on delete restrict,
    evaluator_version text not null check (
        evaluator_version ~ '^[A-Za-z0-9_.:-]{3,80}$'
    ),
    outcome text not null check (outcome in ('accepted', 'failed_closed')),
    reason_code text not null check (
        reason_code ~ '^[a-z0-9_.:-]{2,120}$'
    ),
    invariant_results jsonb not null,
    created_at timestamptz not null default now(),
    check (public.v2_admin_json_is_safe(invariant_results, 32768))
);

create index v2_admin_agent_runs_case
    on public.v2_admin_agent_runs(case_id, created_at desc);
create index v2_admin_agent_handoffs_run
    on public.v2_admin_agent_handoffs(run_id, created_at);

insert into public.v2_admin_agent_versions(
    id, environment, agent_id, agent_version, contract_version,
    registry_version, orchestrator_version, implementation_digest,
    execution_mode, effect_mode
)
select
    ('c2000000-0000-4000-9000-' || lpad(ordinality::text, 12, '0'))::uuid,
    'staging', agent_id, 'ct-shadow-v1', 'ct-agent-contract-v1',
    'ct-agent-registry-v1', 'ct-agent-orchestrator-v1',
    'b83af0c2db48d2ecc899680296c16ec119268f91ae1dcbbcff3e6f8695793ea3',
    'offline_shadow', 'proposals_only'
from unnest(array[
    'front_office', 'internal_operations', 'support', 'installation',
    'device_fleet', 'parental_controls', 'billing_finance', 'privacy',
    'safety', 'security', 'growth', 'release', 'executive'
]) with ordinality as agents(agent_id, ordinality);

create or replace function public.v2_admin_shadow_safe_code(
    target_value text,
    target_max_length integer default 200
)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(
        target_value is not null
        and char_length(target_value) between 1 and target_max_length
        and target_value ~ '^[A-Za-z0-9_.:-]+$',
        false
    );
$$;

create or replace function public.v2_admin_shadow_string_array_is_safe(
    target_value jsonb,
    target_max_items integer,
    target_max_length integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce(
        jsonb_typeof(target_value) = 'array'
        and jsonb_array_length(target_value) <= target_max_items
        and not exists (
            select 1
              from jsonb_array_elements(target_value) item(value)
             where jsonb_typeof(item.value) <> 'string'
                or not public.v2_admin_shadow_safe_code(
                    item.value #>> '{}', target_max_length
                )
        ),
        false
    );
$$;

create or replace function public.v2_admin_valid_shadow_envelope(
    target_value jsonb,
    target_job_id uuid,
    target_case_id uuid,
    target_message_id uuid
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    item jsonb;
    item_value jsonb;
begin
    if target_value is null
       or jsonb_typeof(target_value) <> 'object'
       or not public.v2_admin_json_is_safe(target_value, 131072)
       or exists (
            select 1 from jsonb_object_keys(target_value) supplied(key)
             where supplied.key not in (
                'schema_version', 'contract_version', 'job_kind',
                'execution_mode', 'environment', 'channel_mode', 'job_id',
                'case_id', 'message_ref', 'correlation_id', 'received_at',
                'source_channel', 'case_context', 'intents', 'risk_signals',
                'parent_safe_facts'
             )
       )
       or (select count(*) from jsonb_object_keys(target_value)) <> 16
        or target_value->>'schema_version' is distinct from '1'
        or target_value->>'contract_version' is distinct from 'ct-agent-contract-v1'
        or target_value->>'job_kind' is distinct from 'front_office_shadow'
        or target_value->>'execution_mode' is distinct from 'offline_shadow'
        or target_value->>'environment' is distinct from 'staging'
        or target_value->>'channel_mode' is distinct from 'shadow'
        or target_value->>'job_id' is distinct from target_job_id::text
        or target_value->>'case_id' is distinct from target_case_id::text
        or target_value->>'message_ref' is distinct from target_message_id::text
       or not public.v2_admin_shadow_safe_code(
            target_value->>'correlation_id', 200
       )
       or coalesce(target_value->>'received_at', '') !~
            '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{1,9})?(Z|[+-]\d{2}:\d{2})$'
        or coalesce(target_value->>'source_channel' not in (
            'fixture', 'whatsapp', 'web', 'email'
        ), true)
        or jsonb_typeof(target_value->'case_context') is distinct from 'object'
        or exists (
            select 1
              from jsonb_object_keys(target_value->'case_context') supplied(key)
             where supplied.key not in (
                'current_status', 'priority', 'verification_level',
                'sensitivity'
              )
        )
        or (select count(*) from jsonb_object_keys(
            target_value->'case_context'
        )) <> 4
        or coalesce(target_value#>>'{case_context,current_status}' not in (
            'open', 'triaged', 'identity_pending', 'working',
            'waiting_for_customer', 'waiting_for_data', 'waiting_for_human',
            'waiting_for_external', 'resolution_proposed',
            'verifying_resolution', 'resolved', 'closed'
        ), true)
        or coalesce(target_value#>>'{case_context,priority}' not in (
            's0','s1','s2','s3'
        ), true)
        or coalesce(target_value#>>'{case_context,verification_level}' not in (
            'v0_unknown', 'v1_channel_possession', 'v2_guardian',
            'v3_action_bound'
        ), true)
        or coalesce(target_value#>>'{case_context,sensitivity}' not in (
            'public', 'internal', 'confidential', 'restricted'
        ), true)
        or jsonb_typeof(target_value->'intents') is distinct from 'array'
       or jsonb_array_length(target_value->'intents') > 12
        or jsonb_typeof(target_value->'risk_signals') is distinct from 'array'
       or jsonb_array_length(target_value->'risk_signals') > 12
        or jsonb_typeof(target_value->'parent_safe_facts') is distinct from 'array'
       or jsonb_array_length(target_value->'parent_safe_facts') > 64 then
        return false;
    end if;

    for item in select value from jsonb_array_elements(target_value->'intents')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or exists (
                select 1 from jsonb_object_keys(item) supplied(key)
                  where supplied.key not in ('intent','confidence','evidence_codes')
           )
           or (select count(*) from jsonb_object_keys(item)) <> 3
           or coalesce(item->>'intent' not in (
                'general_intake', 'internal_operations_request',
                'support_question', 'installation_help', 'device_fleet_issue',
                'parental_controls_help', 'billing_question', 'finance_operation',
                'privacy_request', 'safety_incident', 'security_incident',
                'growth_request', 'release_operation', 'executive_request',
                'legal_media_partner_request'
           ), true)
           or jsonb_typeof(item->'confidence') is distinct from 'number'
           or (item->>'confidence')::numeric not between 0 and 1
           or not public.v2_admin_shadow_string_array_is_safe(
                item->'evidence_codes', 12, 100
           ) then
            return false;
        end if;
    end loop;

    for item in select value from jsonb_array_elements(target_value->'risk_signals')
    loop
        if coalesce(item #>> '{}' not in (
            'prompt_injection', 'untrusted_instruction',
            'conflicting_instructions', 'identity_unverified',
            'safety_keyword', 'security_keyword',
            'financial_change_requested', 'customer_requested_human'
        ), true) then
            return false;
        end if;
    end loop;

    for item in
        select value from jsonb_array_elements(target_value->'parent_safe_facts')
    loop
        item_value := item->'value';
        if jsonb_typeof(item) is distinct from 'object'
           or exists (
                select 1 from jsonb_object_keys(item) supplied(key)
                 where supplied.key not in (
                    'classification', 'fact_code', 'value', 'source_code',
                    'freshness'
                  )
           )
           or (select count(*) from jsonb_object_keys(item)) <> 5
           or item->>'classification' is distinct from 'parent_safe'
           or not public.v2_admin_shadow_safe_code(item->>'fact_code', 120)
           or lower(item->>'fact_code') ~
                '(^|[._:-])(email|phone|number|text|body|password|otp|secret|token|raw|message|payload|credential)([._:-]|$)'
           or coalesce(jsonb_typeof(item_value) not in (
                'string', 'number', 'boolean', 'null'
           ), true)
           or (
                jsonb_typeof(item_value) = 'string'
                and (
                    char_length(item_value #>> '{}') > 240
                    or item_value #>> '{}' ~ E'[\r\n]'
                )
           )
           or not coalesce(
                (
                    item->>'fact_code' = 'case.fixture'
                    and item->>'source_code' = 'fixture'
                    and item_value = 'true'::jsonb
                ) or (
                    item->>'fact_code' = 'account.subscription_state'
                    and item->>'source_code' = 'case_projection'
                    and item_value #>> '{}' in (
                        'active','trial','past_due','cancelled','inactive','unknown'
                    )
                ) or (
                    item->>'fact_code' = 'device.platform'
                    and item->>'source_code' = 'device_projection'
                    and item_value #>> '{}' = 'android'
                ) or (
                    item->>'fact_code' = 'installation.phase'
                    and item->>'source_code' = 'device_projection'
                    and item_value #>> '{}' in (
                        'setup','permissions','pairing','activation','ready',
                        'blocked','unknown'
                    )
                ), false
           )
           or coalesce(item->>'freshness' not in (
                'current','stale','unknown'
           ), true) then
            return false;
        end if;
    end loop;
    return true;
exception when others then
    return false;
end;
$$;

create or replace function public.v2_admin_valid_shadow_result(
    target_value jsonb,
    target_job_id uuid,
    target_case_id uuid
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    item jsonb;
begin
    if target_value is null
       or jsonb_typeof(target_value) <> 'object'
       or not public.v2_admin_json_is_safe(target_value, 262144)
       or exists (
            select 1 from jsonb_object_keys(target_value) supplied(key)
             where supplied.key not in (
                'schema_version','contract_version','execution_mode',
                'effect_mode','routing','run_record','handoffs',
                'tool_invocation_requests','tool_invocation_results',
                'case_transitions','memory_write_candidates',
                'human_takeover_requests'
              )
       )
       or (select count(*) from jsonb_object_keys(target_value)) <> 12
        or target_value->>'schema_version' is distinct from '1'
        or target_value->>'contract_version' is distinct from 'ct-agent-contract-v1'
        or target_value->>'execution_mode' is distinct from 'offline_shadow'
        or target_value->>'effect_mode' is distinct from 'proposals_only'
        or jsonb_typeof(target_value->'routing') is distinct from 'object'
        or target_value#>>'{routing,job_id}' is distinct from target_job_id::text
        or target_value#>>'{routing,case_id}' is distinct from target_case_id::text
        or target_value#>>'{routing,effect_mode}' is distinct from 'none'
        or jsonb_typeof(target_value->'run_record') is distinct from 'object'
        or target_value#>>'{run_record,job_id}' is distinct from target_job_id::text
        or target_value#>>'{run_record,case_id}' is distinct from target_case_id::text
        or target_value#>>'{run_record,execution_mode}' is distinct from 'offline_shadow'
        or target_value#>>'{run_record,effect_mode}' is distinct from 'proposals_only'
        or target_value#>>'{run_record,model_used}' is distinct from 'false'
        or target_value#>>'{run_record,network_used}' is distinct from 'false'
        or target_value#>>'{run_record,tools_executed}' is distinct from '0'
        or target_value#>>'{run_record,mutations_applied}' is distinct from '0'
        or target_value#>>'{run_record,outbound_messages_sent}' is distinct from '0'
        or coalesce(target_value#>>'{run_record,status}' not in (
            'completed_shadow','routed_to_human'
        ), true)
        or coalesce(target_value#>>'{run_record,agent_id}' not in (
            'front_office', 'internal_operations', 'support', 'installation',
            'device_fleet', 'parental_controls', 'billing_finance', 'privacy',
            'safety', 'security', 'growth', 'release', 'executive'
        ), true)
       or not public.v2_admin_shadow_safe_code(
            target_value#>>'{run_record,run_id}', 240
       )
        or target_value#>>'{run_record,registry_version}' is distinct from
            'ct-agent-registry-v1'
        or target_value#>>'{run_record,orchestrator_version}' is distinct from
            'ct-agent-orchestrator-v1'
        or jsonb_typeof(target_value->'handoffs') is distinct from 'array'
       or jsonb_array_length(target_value->'handoffs') > 12
        or jsonb_typeof(target_value->'tool_invocation_requests') is distinct from 'array'
       or jsonb_array_length(target_value->'tool_invocation_requests') > 12
        or jsonb_typeof(target_value->'tool_invocation_results') is distinct from 'array'
       or jsonb_array_length(target_value->'tool_invocation_results') > 12
        or jsonb_typeof(target_value->'case_transitions') is distinct from 'array'
       or jsonb_array_length(target_value->'case_transitions') > 12
        or jsonb_typeof(target_value->'memory_write_candidates') is distinct from 'array'
       or jsonb_array_length(target_value->'memory_write_candidates') > 12
        or jsonb_typeof(target_value->'human_takeover_requests') is distinct from 'array'
       or jsonb_array_length(target_value->'human_takeover_requests') > 12 then
        return false;
    end if;

    for item in select value from jsonb_array_elements(target_value->'handoffs')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or item->>'delivery_status' is distinct from 'not_dispatched'
           or item->>'effect_mode' is distinct from 'proposal_only'
           or item->>'authorization_state' is distinct from 'not_authorized'
           or item->>'signed_assignment' is distinct from 'false'
           or item->>'reauthorization_required' is distinct from 'true'
           or item->>'approval_required' is distinct from 'true'
           or item->>'case_id' is distinct from target_case_id::text then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(target_value->'tool_invocation_requests')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or item->>'access_mode' is distinct from 'read_only'
           or item->>'authorization_state' is distinct from 'not_authorized'
           or item->>'delegation_present' is distinct from 'false'
           or item->>'reauthorization_required' is distinct from 'true'
           or item->>'approval_state' is distinct from 'required'
           or item->>'kill_switch_state' is distinct from 'closed'
           or item->>'execution_status' is distinct from 'proposed_not_executed'
           or item->>'effect_mode' is distinct from 'proposal_only' then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(target_value->'tool_invocation_results')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or item->>'status' is distinct from 'not_executed'
           or item->>'effect_mode' is distinct from 'proposal_only' then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(target_value->'case_transitions')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or item->>'requires_human_approval' is distinct from 'true'
           or item->>'apply_status' is distinct from 'not_applied'
           or item->>'effect_mode' is distinct from 'proposal_only' then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(target_value->'memory_write_candidates')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or item->>'requires_human_review' is distinct from 'true'
           or item->>'write_status' is distinct from 'candidate_not_written'
           or item->>'effect_mode' is distinct from 'proposal_only' then return false; end if;
    end loop;
    for item in select value from jsonb_array_elements(target_value->'human_takeover_requests')
    loop
        if jsonb_typeof(item) is distinct from 'object'
           or item->>'dispatch_status' is distinct from 'not_dispatched'
           or item->>'effect_mode' is distinct from 'proposal_only' then return false; end if;
    end loop;
    return true;
exception when others then
    return false;
end;
$$;

alter table public.v2_admin_shadow_jobs
    add constraint v2_admin_shadow_jobs_safe_envelope_contract check (
        safe_input_envelope is null
        or public.v2_admin_valid_shadow_envelope(
            safe_input_envelope, id, case_id, message_id
        )
    );

create or replace function public.v2_admin_set_shadow_job_input_service(
    target_job_id uuid,
    target_idempotency_key text,
    target_envelope jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    job_row public.v2_admin_shadow_jobs%rowtype;
begin
    if not public.v2_admin_shadow_safe_code(target_idempotency_key, 200)
       or char_length(target_idempotency_key) < 8 then
        raise exception 'invalid_shadow_input_idempotency_key'
            using errcode = '22023';
    end if;
    select * into job_row from public.v2_admin_shadow_jobs
     where id = target_job_id for update;
    if not found then raise exception 'shadow_job_not_found' using errcode='P0002'; end if;
    if job_row.environment <> 'staging' or job_row.channel_mode <> 'shadow' then
        raise exception 'control_tower_production_not_activated' using errcode='55000';
    end if;
    if job_row.status not in ('pending','failed_retryable') then
        raise exception 'shadow_job_input_locked' using errcode='55000';
    end if;
    if not public.v2_admin_valid_shadow_envelope(
        target_envelope, job_row.id, job_row.case_id, job_row.message_id
    ) then
        raise exception 'invalid_shadow_input_envelope' using errcode='22023';
    end if;
    if job_row.safe_input_idempotency_key = target_idempotency_key then
        if job_row.safe_input_envelope <> target_envelope then
            raise exception 'shadow_input_idempotency_conflict' using errcode='55000';
        end if;
        return jsonb_build_object('schema_version',1,'duplicate',true,'job_id',job_row.id);
    end if;
    if job_row.safe_input_envelope is not null then
        raise exception 'shadow_job_input_already_attached' using errcode='55000';
    end if;
    update public.v2_admin_shadow_jobs
       set safe_input_envelope=target_envelope,
           safe_input_idempotency_key=target_idempotency_key,
           safe_input_attached_at=now()
     where id=job_row.id;
    return jsonb_build_object('schema_version',1,'duplicate',false,'job_id',job_row.id);
end;
$$;

create or replace function public.v2_admin_claim_shadow_jobs_service(
    target_environment text,
    target_worker_id text,
    target_batch_size integer default 10,
    target_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
begin
    if target_environment = 'production' then
        raise exception 'control_tower_production_not_activated' using errcode='55000';
    end if;
    if target_environment is distinct from 'staging'
       or not public.v2_admin_shadow_safe_code(target_worker_id, 120)
       or target_batch_size not between 1 and 20
       or target_lease_seconds not between 15 and 300 then
        raise exception 'invalid_shadow_claim_request' using errcode='22023';
    end if;

    with exhausted as (
        update public.v2_admin_shadow_jobs job
           set status='dead_letter', dead_lettered_at=now(),
               last_failure_code=coalesce(last_failure_code,'lease_exhausted'),
               last_failed_at=now(), leased_by=null, lease_token=null,
               leased_at=null, lease_expires_at=null
         where job.environment='staging' and job.channel_mode='shadow'
           and job.status='leased' and job.lease_expires_at <= now()
           and job.attempt_count >= job.max_attempts
        returning job.id
    ), audited_exhausted as (
        insert into public.v2_admin_audit_events(
            environment,event_type,outcome,actor_principal_id,case_id,
            purpose_code,object_type,object_id,requested_action,
            executed_action,field_keys,sensitivity,correlation_id,
            version_snapshot,safe_metadata
        )
        select 'staging','agent.shadow_job_dead_lettered','failed',
               'c1000000-0000-4000-8000-000000000006',job.case_id,
               'shadow_agent_runtime','shadow_job',job.id,'shadow.reclaim',
               'dead_letter',array['status','lease'],'restricted',job.id,
               '{"contract":"ct-agent-contract-v1","runtime":"ct-shadow-runtime-v1"}'::jsonb,
               jsonb_build_object('failure_code','lease_exhausted',
                   'attempt_count',job.attempt_count)
          from exhausted
          join public.v2_admin_shadow_jobs job on job.id=exhausted.id
        returning object_id
    ), candidates as (
        select job.id
          from public.v2_admin_shadow_jobs job
         where job.environment='staging' and job.channel_mode='shadow'
           and job.attempt_count < job.max_attempts
           and (
                (job.status in ('pending','failed_retryable') and job.not_before <= now())
                or (job.status='leased' and job.lease_expires_at <= now())
           )
         order by job.not_before, job.created_at, job.id
         for update skip locked
         limit target_batch_size
    ), claimed as (
        update public.v2_admin_shadow_jobs job
           set status='leased', attempt_count=job.attempt_count+1,
               leased_by=target_worker_id, lease_token=gen_random_uuid(),
               leased_at=now(),
               lease_expires_at=now()+make_interval(secs=>target_lease_seconds)
          from candidates
         where job.id=candidates.id
        returning job.*
    ), audited as (
        insert into public.v2_admin_audit_events(
            environment,event_type,outcome,actor_principal_id,case_id,
            purpose_code,object_type,object_id,requested_action,
            field_keys,sensitivity,correlation_id,version_snapshot,safe_metadata
        )
        select 'staging','agent.shadow_job_claimed','success',
               'c1000000-0000-4000-8000-000000000006',claimed.case_id,
               'shadow_agent_runtime','shadow_job',claimed.id,'shadow.claim',
               array['status','lease'],'restricted',claimed.id,
               '{"contract":"ct-agent-contract-v1","runtime":"ct-shadow-runtime-v1"}'::jsonb,
               jsonb_build_object('attempt_count',claimed.attempt_count,'worker_id',target_worker_id)
          from claimed
        returning object_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'job_id', claimed.id,
        'lease_token', claimed.lease_token,
        'attempt_count', claimed.attempt_count,
        'max_attempts', claimed.max_attempts,
        'input_state', case when claimed.safe_input_envelope is null
            then 'insufficient_evidence' else 'parent_safe' end,
        'envelope', coalesce(claimed.safe_input_envelope, jsonb_build_object(
            'schema_version',1,
            'contract_version','ct-agent-contract-v1',
            'job_kind','front_office_shadow',
            'execution_mode','offline_shadow',
            'environment','staging',
            'channel_mode','shadow',
            'job_id',claimed.id::text,
            'case_id',claimed.case_id::text,
            'message_ref',claimed.message_id::text,
            'correlation_id',claimed.id::text,
            'received_at',to_char(message.server_received_at at time zone 'UTC',
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'source_channel',case when conversation.channel in ('fixture','whatsapp','web','email')
                then conversation.channel else 'whatsapp' end,
            'case_context',jsonb_build_object(
                'current_status',admin_case.status,
                'priority',admin_case.priority,
                'verification_level',admin_case.verification_level,
                'sensitivity',admin_case.sensitivity
            ),
            'intents','[]'::jsonb,
            'risk_signals',case when admin_case.verification_level='v0_unknown'
                then '["identity_unverified"]'::jsonb else '[]'::jsonb end,
            'parent_safe_facts','[]'::jsonb
        ))
    ) order by claimed.created_at, claimed.id),'[]'::jsonb)
      into result_data
      from claimed
      join public.v2_support_messages message on message.id=claimed.message_id
      join public.v2_support_conversations conversation on conversation.id=message.conversation_id
      join public.v2_admin_cases admin_case on admin_case.id=claimed.case_id
      join audited on audited.object_id=claimed.id;

    return jsonb_build_object('schema_version',1,'environment','staging','jobs',result_data);
end;
$$;

create or replace function public.v2_admin_complete_shadow_job_service(
    target_job_id uuid,
    target_lease_token uuid,
    target_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    job_row public.v2_admin_shadow_jobs%rowtype;
    run_id_value uuid;
    version_id_value uuid;
    handoff jsonb;
    input_state_value text;
    decision_code_value text;
begin
    select * into job_row from public.v2_admin_shadow_jobs
     where id=target_job_id for update;
    if not found then raise exception 'shadow_job_not_found' using errcode='P0002'; end if;
    if job_row.environment <> 'staging' or job_row.channel_mode <> 'shadow' then
        raise exception 'control_tower_production_not_activated' using errcode='55000';
    end if;
    if job_row.status='completed' then
        select id into run_id_value from public.v2_admin_agent_runs where job_id=job_row.id;
        return jsonb_build_object('schema_version',1,'duplicate',true,'job_id',job_row.id,'run_id',run_id_value);
    end if;
    if job_row.status <> 'leased'
       or job_row.lease_token is distinct from target_lease_token
       or job_row.lease_expires_at <= now() then
        raise exception 'shadow_job_lease_lost' using errcode='55000';
    end if;
    if not public.v2_admin_valid_shadow_result(target_result,job_row.id,job_row.case_id) then
        raise exception 'invalid_shadow_result' using errcode='22023';
    end if;
    select id into version_id_value from public.v2_admin_agent_versions
     where environment='staging'
       and agent_id=target_result#>>'{run_record,agent_id}'
       and agent_version='ct-shadow-v1'
       and contract_version=target_result->>'contract_version'
       and registry_version=target_result#>>'{run_record,registry_version}'
       and orchestrator_version=target_result#>>'{run_record,orchestrator_version}';
    if version_id_value is null then
        raise exception 'shadow_agent_version_not_registered' using errcode='55000';
    end if;
    input_state_value := case when job_row.safe_input_envelope is null
        then 'insufficient_evidence' else 'parent_safe' end;
    decision_code_value := target_result#>>'{routing,decision_code}';
    insert into public.v2_admin_agent_runs(
        environment,job_id,case_id,agent_version_id,run_key,correlation_id,
        input_state,status,decision_code,routing_payload,result_payload,
        model_used,network_used,tools_executed,mutations_applied,
        outbound_messages_sent,contract_version,registry_version,
        orchestrator_version
    ) values (
        'staging',job_row.id,job_row.case_id,version_id_value,
        target_result#>>'{run_record,run_id}',job_row.id,input_state_value,
        target_result#>>'{run_record,status}',decision_code_value,
        target_result->'routing',target_result,
        false,false,0,0,0,target_result->>'contract_version',
        target_result#>>'{run_record,registry_version}',
        target_result#>>'{run_record,orchestrator_version}'
    ) returning id into run_id_value;
    for handoff in select value from jsonb_array_elements(target_result->'handoffs')
    loop
        insert into public.v2_admin_agent_handoffs(
            environment,run_id,case_id,handoff_key,handoff_kind,
            destination_kind,destination_key,reason_code,delivery_status,
            effect_mode,handoff_payload
        ) values (
            'staging',run_id_value,job_row.case_id,handoff->>'handoff_id',
            handoff->>'handoff_kind',handoff#>>'{to,kind}',
            coalesce(handoff#>>'{to,agent_id}',handoff#>>'{to,queue}'),
            handoff->>'reason_code','not_dispatched','proposal_only',handoff
        );
    end loop;
    insert into public.v2_admin_agent_evaluations(
        environment,run_id,evaluator_version,outcome,reason_code,invariant_results
    ) values (
        'staging',run_id_value,'ct-shadow-invariants-v1',
        case when input_state_value='insufficient_evidence'
            then 'failed_closed' else 'accepted' end,
        case when input_state_value='insufficient_evidence'
            then 'insufficient_evidence' else decision_code_value end,
        jsonb_build_object(
            'offline_shadow',true,'proposals_only',true,'model_used',false,
            'network_used',false,'tools_executed',0,'mutations_applied',0,
            'outbound_messages_sent',0
        )
    );
    update public.v2_admin_shadow_jobs
       set status='completed',completed_at=now(),leased_by=null,
           lease_token=null,leased_at=null,lease_expires_at=null
     where id=job_row.id;
    insert into public.v2_admin_audit_events(
        environment,event_type,outcome,actor_principal_id,case_id,
        purpose_code,object_type,object_id,requested_action,executed_action,
        field_keys,sensitivity,correlation_id,version_snapshot,safe_metadata
    ) values (
        'staging','agent.shadow_job_completed','success',
        'c1000000-0000-4000-8000-000000000006',job_row.case_id,
        'shadow_agent_runtime','shadow_job',job_row.id,'shadow.complete',
        'proposal.persisted',array['routing','handoffs','evaluation'],'restricted',
        job_row.id,
        jsonb_build_object('contract',target_result->>'contract_version',
            'registry',target_result#>>'{run_record,registry_version}',
            'orchestrator',target_result#>>'{run_record,orchestrator_version}'),
        jsonb_build_object('decision_code',decision_code_value,
            'input_state',input_state_value,'effect_mode','proposals_only')
    );
    return jsonb_build_object('schema_version',1,'duplicate',false,'job_id',job_row.id,'run_id',run_id_value);
end;
$$;

create or replace function public.v2_admin_fail_shadow_job_service(
    target_job_id uuid,
    target_lease_token uuid,
    target_failure_code text,
    target_retryable boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    job_row public.v2_admin_shadow_jobs%rowtype;
    next_status text;
    retry_delay integer;
begin
    if not public.v2_admin_shadow_safe_code(target_failure_code,120) then
        raise exception 'invalid_shadow_failure_code' using errcode='22023';
    end if;
    if target_retryable is null then
        raise exception 'invalid_shadow_retryable_flag' using errcode='22023';
    end if;
    select * into job_row from public.v2_admin_shadow_jobs
     where id=target_job_id for update;
    if not found then raise exception 'shadow_job_not_found' using errcode='P0002'; end if;
    if job_row.environment <> 'staging' then
        raise exception 'control_tower_production_not_activated' using errcode='55000';
    end if;
    if job_row.status in ('completed','dead_letter','cancelled') then
        return jsonb_build_object('schema_version',1,'duplicate',true,'job_id',job_row.id,'status',job_row.status);
    end if;
    if job_row.status <> 'leased'
       or job_row.lease_token is distinct from target_lease_token
       or job_row.lease_expires_at <= now() then
        raise exception 'shadow_job_lease_lost' using errcode='55000';
    end if;
    if target_retryable and job_row.attempt_count < job_row.max_attempts then
        next_status := 'failed_retryable';
        retry_delay := least(300,5*power(2,greatest(job_row.attempt_count-1,0))::integer);
        update public.v2_admin_shadow_jobs set
            status=next_status,not_before=now()+make_interval(secs=>retry_delay),
            last_failure_code=target_failure_code,last_failed_at=now(),
            leased_by=null,lease_token=null,leased_at=null,lease_expires_at=null
         where id=job_row.id;
    else
        next_status := 'dead_letter';
        update public.v2_admin_shadow_jobs set
            status=next_status,dead_lettered_at=now(),
            last_failure_code=target_failure_code,last_failed_at=now(),
            leased_by=null,lease_token=null,leased_at=null,lease_expires_at=null
         where id=job_row.id;
    end if;
    insert into public.v2_admin_audit_events(
        environment,event_type,outcome,actor_principal_id,case_id,
        purpose_code,object_type,object_id,requested_action,executed_action,
        field_keys,sensitivity,correlation_id,version_snapshot,safe_metadata
    ) values (
        'staging',case when next_status='dead_letter'
            then 'agent.shadow_job_dead_lettered' else 'agent.shadow_job_retry_scheduled' end,
        'failed','c1000000-0000-4000-8000-000000000006',job_row.case_id,
        'shadow_agent_runtime','shadow_job',job_row.id,'shadow.fail',next_status,
        array['status','failure_code'],'restricted',job_row.id,
        '{"contract":"ct-agent-contract-v1","runtime":"ct-shadow-runtime-v1"}'::jsonb,
        jsonb_build_object('failure_code',target_failure_code,
            'attempt_count',job_row.attempt_count,'retryable',target_retryable)
    );
    return jsonb_build_object('schema_version',1,'duplicate',false,'job_id',job_row.id,'status',next_status);
end;
$$;

do $$
declare table_name text;
begin
    foreach table_name in array array[
        'v2_admin_agent_versions','v2_admin_agent_runs',
        'v2_admin_agent_handoffs','v2_admin_agent_evaluations'
    ] loop
        execute format('alter table public.%I enable row level security',table_name);
        execute format('alter table public.%I force row level security',table_name);
        execute format('revoke all on table public.%I from public, anon, authenticated, service_role',table_name);
    end loop;
end
$$;

create trigger v2_admin_agent_versions_immutable
before update or delete on public.v2_admin_agent_versions
for each row execute function public.v2_admin_keep_append_only();
create trigger v2_admin_agent_runs_immutable
before update or delete on public.v2_admin_agent_runs
for each row execute function public.v2_admin_keep_append_only();
create trigger v2_admin_agent_handoffs_immutable
before update or delete on public.v2_admin_agent_handoffs
for each row execute function public.v2_admin_keep_append_only();
create trigger v2_admin_agent_evaluations_immutable
before update or delete on public.v2_admin_agent_evaluations
for each row execute function public.v2_admin_keep_append_only();

revoke all on function public.v2_admin_shadow_safe_code(text,integer)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_shadow_string_array_is_safe(jsonb,integer,integer)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_valid_shadow_envelope(jsonb,uuid,uuid,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_valid_shadow_result(jsonb,uuid,uuid)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_set_shadow_job_input_service(uuid,text,jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_claim_shadow_jobs_service(text,text,integer,integer)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_complete_shadow_job_service(uuid,uuid,jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.v2_admin_fail_shadow_job_service(uuid,uuid,text,boolean)
from public,anon,authenticated,service_role;

grant execute on function public.v2_admin_set_shadow_job_input_service(uuid,text,jsonb)
to service_role;
grant execute on function public.v2_admin_claim_shadow_jobs_service(text,text,integer,integer)
to service_role;
grant execute on function public.v2_admin_complete_shadow_job_service(uuid,uuid,jsonb)
to service_role;
grant execute on function public.v2_admin_fail_shadow_job_service(uuid,uuid,text,boolean)
to service_role;

commit;
