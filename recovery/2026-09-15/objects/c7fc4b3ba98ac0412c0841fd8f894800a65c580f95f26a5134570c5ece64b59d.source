begin;

-- Forward-only hardening for the already-applied shadow and waitlist
-- contracts. Historical migration blobs remain unchanged.

create or replace function public.v2_admin_shadow_object_keys_are_allowed(
    target_value jsonb,
    target_allowed_keys text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select case
        when jsonb_typeof(target_value) is distinct from 'object' then false
        else not exists (
            select 1
              from jsonb_object_keys(target_value) supplied(key)
             where not (supplied.key = any(target_allowed_keys))
        )
    end;
$$;

revoke all on function public.v2_admin_shadow_object_keys_are_allowed(jsonb, text[])
    from public, anon, authenticated, service_role;

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
        or not public.v2_admin_shadow_object_keys_are_allowed(
            target_value->'routing',
            array['job_id','case_id','effect_mode','decision_code']
        )
        or target_value#>>'{routing,job_id}' is distinct from target_job_id::text
        or target_value#>>'{routing,case_id}' is distinct from target_case_id::text
        or target_value#>>'{routing,effect_mode}' is distinct from 'none'
        or not public.v2_admin_shadow_safe_code(
            target_value#>>'{routing,decision_code}', 120
        )
        or not public.v2_admin_shadow_object_keys_are_allowed(
            target_value->'run_record',
            array[
                'job_id','case_id','execution_mode','effect_mode','model_used',
                'network_used','tools_executed','mutations_applied',
                'outbound_messages_sent','status','agent_id','run_id',
                'registry_version','orchestrator_version'
            ]
        )
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
        if not public.v2_admin_shadow_object_keys_are_allowed(
            item,
            array[
                'handoff_id','handoff_kind','to','reason_code','delivery_status',
                'effect_mode','authorization_state','signed_assignment',
                'reauthorization_required','approval_required','case_id'
            ]
        )
           or not public.v2_admin_shadow_object_keys_are_allowed(
               item->'to', array['kind','agent_id','queue']
           )
           or not public.v2_admin_shadow_safe_code(item->>'handoff_id', 240)
           or coalesce(
               item->>'handoff_kind' not in ('agent_assignment', 'human_takeover'),
               true
           )
           or item->>'delivery_status' is distinct from 'not_dispatched'
           or item->>'effect_mode' is distinct from 'proposal_only'
           or item->>'authorization_state' is distinct from 'not_authorized'
           or item->>'signed_assignment' is distinct from 'false'
           or item->>'reauthorization_required' is distinct from 'true'
           or item->>'approval_required' is distinct from 'true'
           or item->>'case_id' is distinct from target_case_id::text
           or coalesce(
               item#>>'{to,kind}' not in ('agent', 'human_queue'),
               true
           )
           or (item#>>'{to,kind}' = 'agent'
               and not public.v2_admin_shadow_safe_code(item#>>'{to,agent_id}', 120))
           or (item#>>'{to,kind}' = 'human_queue'
               and not public.v2_admin_shadow_safe_code(item#>>'{to,queue}', 120))
           or (item#>>'{to,kind}' = 'agent' and item#>>'{to,queue}' is not null)
           or (item#>>'{to,kind}' = 'human_queue' and item#>>'{to,agent_id}' is not null)
           or (item->>'handoff_kind' = 'agent_assignment'
               and item#>>'{to,kind}' <> 'agent')
           or (item->>'handoff_kind' = 'human_takeover'
               and item#>>'{to,kind}' <> 'human_queue')
           or not public.v2_admin_shadow_safe_code(item->>'reason_code', 120)
        then return false; end if;
    end loop;

    for item in select value from jsonb_array_elements(target_value->'tool_invocation_requests')
    loop
        if not public.v2_admin_shadow_object_keys_are_allowed(
            item,
            array[
                'request_id','tool_name','access_mode','authorization_state',
                'delegation_present','reauthorization_required','approval_state',
                'kill_switch_state','execution_status','effect_mode'
            ]
        )
           or (item->>'request_id' is not null
               and not public.v2_admin_shadow_safe_code(item->>'request_id', 240))
           or (item->>'tool_name' is not null
               and not public.v2_admin_shadow_safe_code(item->>'tool_name', 120))
           or item->>'access_mode' is distinct from 'read_only'
           or item->>'authorization_state' is distinct from 'not_authorized'
           or item->>'delegation_present' is distinct from 'false'
           or item->>'reauthorization_required' is distinct from 'true'
           or item->>'approval_state' is distinct from 'required'
           or item->>'kill_switch_state' is distinct from 'closed'
           or item->>'execution_status' is distinct from 'proposed_not_executed'
           or item->>'effect_mode' is distinct from 'proposal_only'
        then return false; end if;
    end loop;

    for item in select value from jsonb_array_elements(target_value->'tool_invocation_results')
    loop
        if not public.v2_admin_shadow_object_keys_are_allowed(
            item, array['request_id','status','effect_mode','result_code']
        )
           or (item->>'request_id' is not null
               and not public.v2_admin_shadow_safe_code(item->>'request_id', 240))
           or (item->>'result_code' is not null
               and not public.v2_admin_shadow_safe_code(item->>'result_code', 120))
           or item->>'status' is distinct from 'not_executed'
           or item->>'effect_mode' is distinct from 'proposal_only'
        then return false; end if;
    end loop;

    for item in select value from jsonb_array_elements(target_value->'case_transitions')
    loop
        if not public.v2_admin_shadow_object_keys_are_allowed(
            item,
            array[
                'transition_id','target_status','reason_code',
                'requires_human_approval','apply_status','effect_mode'
            ]
        )
           or (item->>'transition_id' is not null
               and not public.v2_admin_shadow_safe_code(item->>'transition_id', 240))
           or (item->>'target_status' is not null
               and not public.v2_admin_shadow_safe_code(item->>'target_status', 120))
           or (item->>'reason_code' is not null
               and not public.v2_admin_shadow_safe_code(item->>'reason_code', 120))
           or item->>'requires_human_approval' is distinct from 'true'
           or item->>'apply_status' is distinct from 'not_applied'
           or item->>'effect_mode' is distinct from 'proposal_only'
        then return false; end if;
    end loop;

    for item in select value from jsonb_array_elements(target_value->'memory_write_candidates')
    loop
        if not public.v2_admin_shadow_object_keys_are_allowed(
            item,
            array[
                'candidate_id','memory_kind','reason_code',
                'requires_human_review','write_status','effect_mode'
            ]
        )
           or (item->>'candidate_id' is not null
               and not public.v2_admin_shadow_safe_code(item->>'candidate_id', 240))
           or (item->>'memory_kind' is not null
               and not public.v2_admin_shadow_safe_code(item->>'memory_kind', 120))
           or (item->>'reason_code' is not null
               and not public.v2_admin_shadow_safe_code(item->>'reason_code', 120))
           or item->>'requires_human_review' is distinct from 'true'
           or item->>'write_status' is distinct from 'candidate_not_written'
           or item->>'effect_mode' is distinct from 'proposal_only'
        then return false; end if;
    end loop;

    for item in select value from jsonb_array_elements(target_value->'human_takeover_requests')
    loop
        if not public.v2_admin_shadow_object_keys_are_allowed(
            item,
            array['request_id','queue','reason_code','dispatch_status','effect_mode']
        )
           or (item->>'request_id' is not null
               and not public.v2_admin_shadow_safe_code(item->>'request_id', 240))
           or (item->>'queue' is not null
               and not public.v2_admin_shadow_safe_code(item->>'queue', 120))
           or (item->>'reason_code' is not null
               and not public.v2_admin_shadow_safe_code(item->>'reason_code', 120))
           or item->>'dispatch_status' is distinct from 'not_dispatched'
           or item->>'effect_mode' is distinct from 'proposal_only'
        then return false; end if;
    end loop;

    return true;
exception when others then
    return false;
end;
$$;

revoke all on function public.v2_admin_valid_shadow_result(jsonb, uuid, uuid)
    from public, anon, authenticated, service_role;

create or replace function public.v2_marketing_touch_is_valid(target_touch jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
    if target_touch is null
       or jsonb_typeof(target_touch) is distinct from 'object' then
        return false;
    end if;
    if octet_length(target_touch::text) > 4096
       or target_touch::text ~ '[<>]'
       or exists (
           select 1
             from jsonb_each(target_touch) entry
            where entry.key not in (
                'utm_source', 'utm_medium', 'utm_campaign',
                'utm_content', 'utm_term', 'landing_path'
            )
               or jsonb_typeof(entry.value) not in ('string', 'null')
       ) then
        return false;
    end if;
    return coalesce(target_touch->>'landing_path', '') like '/%'
       and char_length(coalesce(target_touch->>'landing_path', '')) <= 300;
exception when others then
    return false;
end;
$$;

revoke all on function public.v2_marketing_touch_is_valid(jsonb)
    from public, anon, authenticated, service_role;

create schema v2_private;
revoke all on schema v2_private from public, anon, authenticated, service_role;

create table v2_private.v2_marketing_waitlist_rate_secrets (
    singleton boolean primary key default true check (singleton),
    secret_value bytea not null check (octet_length(secret_value) = 32),
    created_at timestamptz not null default now()
);

insert into v2_private.v2_marketing_waitlist_rate_secrets (
    singleton, secret_value
) values (
    true, extensions.gen_random_bytes(32)
);

alter table v2_private.v2_marketing_waitlist_rate_secrets enable row level security;
alter table v2_private.v2_marketing_waitlist_rate_secrets force row level security;
revoke all on table v2_private.v2_marketing_waitlist_rate_secrets
    from public, anon, authenticated, service_role;

create table public.v2_marketing_waitlist_rate_limits (
    rate_key text primary key check (rate_key ~ '^[0-9a-f]{64}$'),
    window_started_at timestamptz not null,
    submission_count integer not null check (submission_count >= 0),
    updated_at timestamptz not null default now()
);

create index v2_marketing_waitlist_rate_limits_updated_at_idx
    on public.v2_marketing_waitlist_rate_limits (updated_at);

alter table public.v2_marketing_waitlist_rate_limits enable row level security;
alter table public.v2_marketing_waitlist_rate_limits force row level security;
alter table public.v2_marketing_waitlist_signups force row level security;
revoke all on table public.v2_marketing_waitlist_signups
    from public, anon, authenticated, service_role;
revoke all on table public.v2_marketing_waitlist_rate_limits
    from public, anon, authenticated, service_role;

create or replace function public.v2_submit_marketing_waitlist(
    target_parent_name text,
    target_email text,
    target_phone text,
    target_child_age smallint,
    target_device_os text,
    target_region text default null,
    target_referral_source text default null,
    target_referral_other text default null,
    target_first_touch jsonb default '{"landing_path":"/"}'::jsonb,
    target_submission_touch jsonb default '{"landing_path":"/"}'::jsonb,
    target_landing_path text default '/',
    target_referrer_host text default null,
    target_marketing_notice_version text default 'waitlist-updates-v1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    normalized_name text := btrim(target_parent_name);
    normalized_email text := lower(btrim(target_email));
    normalized_phone text := regexp_replace(coalesce(target_phone, ''), '[-[:space:]]', '', 'g');
    normalized_device_os text := lower(btrim(target_device_os));
    normalized_region text := nullif(btrim(target_region), '');
    normalized_referral_source text := nullif(btrim(target_referral_source), '');
    normalized_referral_other text := nullif(btrim(target_referral_other), '');
    normalized_landing_path text := btrim(target_landing_path);
    normalized_referrer_host text := nullif(btrim(target_referrer_host), '');
    rate_secret_value bytea;
    global_rate_key text;
    email_rate_key text;
    phone_rate_key text;
    global_submission_count integer;
    email_submission_count integer;
    phone_submission_count integer;
    global_rate_limit constant integer := 300;
    identity_rate_limit constant integer := 5;
    acknowledgement_id uuid := gen_random_uuid();
    payload_is_valid boolean;
    server_notice_version constant text := 'waitlist-updates-v1';
begin
    -- Retain the existing RPC signature for clients while keeping the notice
    -- version server-owned; the caller-supplied value has no effect.
    perform target_marketing_notice_version;

    select secret_value
      into strict rate_secret_value
      from v2_private.v2_marketing_waitlist_rate_secrets
     where singleton;

    global_rate_key := encode(
        extensions.hmac(
            convert_to('global:v1', 'utf8'), rate_secret_value, 'sha256'
        ),
        'hex'
    );
    email_rate_key := encode(
        extensions.hmac(
            convert_to(
                'email:v1:' || left(coalesce(normalized_email, ''), 512),
                'utf8'
            ),
            rate_secret_value,
            'sha256'
        ),
        'hex'
    );
    phone_rate_key := encode(
        extensions.hmac(
            convert_to(
                'phone:v1:' || left(normalized_phone, 64),
                'utf8'
            ),
            rate_secret_value,
            'sha256'
        ),
        'hex'
    );

    delete from public.v2_marketing_waitlist_rate_limits target
     where target.rate_key in (
         select stale.rate_key
           from public.v2_marketing_waitlist_rate_limits stale
          where stale.updated_at < now() - interval '10 minutes'
          order by stale.updated_at
          limit 25
     );

    insert into public.v2_marketing_waitlist_rate_limits (
        rate_key, window_started_at, submission_count
    ) values (
        global_rate_key, now(), 1
    )
    on conflict (rate_key) do update
       set window_started_at = case
           when public.v2_marketing_waitlist_rate_limits.window_started_at
                <= now() - interval '1 minute' then now()
           else public.v2_marketing_waitlist_rate_limits.window_started_at
       end,
           submission_count = case
           when public.v2_marketing_waitlist_rate_limits.window_started_at
                <= now() - interval '1 minute' then 1
           else least(
               public.v2_marketing_waitlist_rate_limits.submission_count::bigint + 1,
               2147483647
           )::integer
       end,
           updated_at = now()
    returning submission_count into global_submission_count;

    if global_submission_count > global_rate_limit then
        return acknowledgement_id;
    end if;

    insert into public.v2_marketing_waitlist_rate_limits (
        rate_key, window_started_at, submission_count
    ) values (
        email_rate_key, now(), 1
    )
    on conflict (rate_key) do update
       set window_started_at = case
           when public.v2_marketing_waitlist_rate_limits.window_started_at
                <= now() - interval '1 minute' then now()
           else public.v2_marketing_waitlist_rate_limits.window_started_at
       end,
           submission_count = case
           when public.v2_marketing_waitlist_rate_limits.window_started_at
                <= now() - interval '1 minute' then 1
           else least(
               public.v2_marketing_waitlist_rate_limits.submission_count::bigint + 1,
               2147483647
           )::integer
       end,
           updated_at = now()
    returning submission_count into email_submission_count;

    insert into public.v2_marketing_waitlist_rate_limits (
        rate_key, window_started_at, submission_count
    ) values (
        phone_rate_key, now(), 1
    )
    on conflict (rate_key) do update
       set window_started_at = case
           when public.v2_marketing_waitlist_rate_limits.window_started_at
                <= now() - interval '1 minute' then now()
           else public.v2_marketing_waitlist_rate_limits.window_started_at
       end,
           submission_count = case
           when public.v2_marketing_waitlist_rate_limits.window_started_at
                <= now() - interval '1 minute' then 1
           else least(
               public.v2_marketing_waitlist_rate_limits.submission_count::bigint + 1,
               2147483647
           )::integer
       end,
           updated_at = now()
    returning submission_count into phone_submission_count;

    if email_submission_count > identity_rate_limit
       or phone_submission_count > identity_rate_limit then
        return acknowledgement_id;
    end if;

    payload_is_valid :=
        normalized_name is not null
        and char_length(normalized_name) between 2 and 120
        and normalized_name !~ '[<>]'
        and normalized_email is not null
        and char_length(normalized_email) between 3 and 320
        and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
        and normalized_email !~ '[<>]'
        and normalized_phone ~ '^05[0-9]{8}$'
        and target_child_age between 4 and 18
        and normalized_device_os in ('android', 'iphone')
        and (
            normalized_region is null
            or normalized_region in (
                'center', 'sharon', 'north', 'jerusalem', 'lowlands',
                'south', 'abroad'
            )
        )
        and (
            normalized_referral_source is null
            or normalized_referral_source in (
                'tv_press', 'websites', 'friends', 'search', 'other'
            )
        )
        and (
            normalized_referral_other is null
            or (
                char_length(normalized_referral_other) between 1 and 240
                and normalized_referral_other !~ '[<>]'
            )
        )
        and (
            (normalized_referral_source = 'other'
             and normalized_referral_other is not null)
            or (normalized_referral_source is distinct from 'other'
                and normalized_referral_other is null)
        )
        and coalesce(
            public.v2_marketing_touch_is_valid(target_first_touch), false
        )
        and coalesce(
            public.v2_marketing_touch_is_valid(target_submission_touch), false
        )
        and normalized_landing_path is not null
        and char_length(normalized_landing_path) between 1 and 300
        and normalized_landing_path like '/%'
        and normalized_landing_path !~ '[<>]'
        and (
            normalized_referrer_host is null
            or (
                char_length(normalized_referrer_host) between 1 and 255
                and normalized_referrer_host !~ '[/<>]'
            )
        );

    if not coalesce(payload_is_valid, false) then
        return acknowledgement_id;
    end if;

    insert into public.v2_marketing_waitlist_signups (
        parent_name, email, phone, child_age, device_os, region,
        referral_source, referral_other, first_touch, submission_touch,
        landing_path, referrer_host, marketing_notice_version
    ) values (
        normalized_name, normalized_email, normalized_phone, target_child_age,
        normalized_device_os, normalized_region, normalized_referral_source,
        normalized_referral_other, target_first_touch, target_submission_touch,
        normalized_landing_path, normalized_referrer_host, server_notice_version
    )
    on conflict (lower(email)) do nothing;

    return acknowledgement_id;
end;
$$;

revoke all on function public.v2_submit_marketing_waitlist(
    text, text, text, smallint, text, text, text, text, jsonb, jsonb, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.v2_submit_marketing_waitlist(
    text, text, text, smallint, text, text, text, text, jsonb, jsonb, text, text, text
) to service_role;

comment on table public.v2_marketing_waitlist_signups is
    'Edge-gated pre-launch waitlist storage with no direct API-role access.';
comment on table public.v2_marketing_waitlist_rate_limits is
    'HMAC-keyed per-email, per-phone, and emergency global waitlist windows with opportunistic stale-key pruning.';
comment on table v2_private.v2_marketing_waitlist_rate_secrets is
    'Server-only HMAC material for pseudonymous waitlist rate keys.';
comment on function public.v2_submit_marketing_waitlist(
    text, text, text, smallint, text, text, text, text, jsonb, jsonb, text, text, text
) is
    'Service-only waitlist persistence boundary behind a trusted edge gate; every outcome returns an opaque acknowledgement.';

commit;
