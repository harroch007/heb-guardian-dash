begin;

-- AAD v3 fixes every timestamp to UTC with exactly three fractional digits.
-- Existing payloads predate that invariant and remain unclaimable by the v3
-- analyzer; they can age out under the existing encrypted-context retention.
alter table public.v2_incident_context
    add column aad_version smallint;

update public.v2_incident_context
   set aad_version = 2
 where aad_version is null;

alter table public.v2_incident_context
    alter column aad_version set default 3,
    alter column aad_version set not null,
    add constraint v2_incident_context_aad_version_check
        check (aad_version in (2, 3));

comment on column public.v2_incident_context.aad_version is
    'Cryptographic AAD contract. Only canonical v3 contexts are eligible for expert analysis.';

create table public.v2_analyzer_capabilities (
    id uuid primary key default gen_random_uuid(),
    capability_name text not null unique
        check (char_length(capability_name) between 1 and 80),
    token_hash bytea not null unique
        check (octet_length(token_hash) = 32),
    token_version integer not null
        check (token_version > 0),
    status text not null default 'active'
        check (status in ('active', 'revoked')),
    not_before timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (expires_at > not_before),
    check (
        (status = 'active' and revoked_at is null)
        or (status = 'revoked' and revoked_at is not null)
    )
);

comment on table public.v2_analyzer_capabilities is
    'Hash-only, independently rotated authorization for the expert analyzer. The raw capability is never stored in Supabase or Git.';

create table public.v2_incident_analysis_jobs (
    incident_id uuid primary key
        references public.v2_incident_context(incident_id)
        on delete cascade,
    state text not null default 'pending'
        check (
            state in (
                'pending',
                'leased',
                'retry',
                'completed',
                'terminal_failed'
            )
        ),
    attempt_count integer not null default 0
        check (attempt_count between 0 and 12),
    outage_count integer not null default 0
        check (outage_count between 0 and 10000),
    max_attempts integer not null default 5
        check (max_attempts between 1 and 12),
    next_attempt_at timestamptz not null default now(),
    lease_owner uuid,
    lease_token_hash bytea
        check (
            lease_token_hash is null
            or octet_length(lease_token_hash) = 32
        ),
    lease_expires_at timestamptz,
    last_error_code text
        check (
            last_error_code is null
            or last_error_code ~ '^[a-z0-9_]{1,80}$'
        ),
    last_error_class text
        check (
            last_error_class is null
            or last_error_class in (
                'provider_transient',
                'configuration',
                'worker_transient',
                'analysis'
            )
        ),
    completion_request_hash bytea
        check (
            completion_request_hash is null
            or octet_length(completion_request_hash) = 32
        ),
    completion_lease_token_hash bytea
        check (
            completion_lease_token_hash is null
            or octet_length(completion_lease_token_hash) = 32
        ),
    completion_incident_status text,
    completion_analysis_outcome text,
    completion_delivery_count integer
        check (
            completion_delivery_count is null
            or completion_delivery_count >= 0
        ),
    completed_at timestamptz,
    terminal_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (
            state = 'leased'
            and lease_owner is not null
            and lease_token_hash is not null
            and lease_expires_at is not null
        )
        or (
            state <> 'leased'
            and lease_owner is null
            and lease_token_hash is null
            and lease_expires_at is null
        )
    ),
    check (
        (
            state = 'completed'
            and completed_at is not null
            and terminal_at is null
            and completion_request_hash is not null
            and completion_lease_token_hash is not null
            and completion_incident_status is not null
            and completion_analysis_outcome is not null
            and completion_delivery_count is not null
        )
        or (
            state = 'terminal_failed'
            and completed_at is null
            and terminal_at is not null
            and completion_request_hash is null
            and completion_lease_token_hash is null
            and completion_incident_status is null
            and completion_analysis_outcome is null
            and completion_delivery_count is null
        )
        or (
            state not in ('completed', 'terminal_failed')
            and completed_at is null
            and terminal_at is null
            and completion_request_hash is null
            and completion_lease_token_hash is null
            and completion_incident_status is null
            and completion_analysis_outcome is null
            and completion_delivery_count is null
        )
    )
);

create index v2_incident_analysis_jobs_claim
    on public.v2_incident_analysis_jobs (
        state,
        next_attempt_at,
        lease_expires_at
    );

create or replace function public.v2_valid_segment_refs(
    target_refs text[]
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select
        target_refs is not null
        and cardinality(target_refs) between 1 and 60
        and cardinality(target_refs) = (
            select count(distinct ref_value)
            from unnest(target_refs) as ref_value
        )
        and not exists (
            select 1
            from unnest(target_refs) as ref_value
            where ref_value !~ '^[A-Za-z0-9_-]{22}$'
        );
$$;

create table public.v2_incident_analysis_details (
    incident_id uuid primary key
        references public.v2_incident_analysis(incident_id)
        on delete cascade,
    expert_category text not null
        check (
            expert_category in (
                'bullying',
                'exclusion',
                'sexual_content',
                'violence',
                'grooming',
                'manipulation',
                'stranger_contact',
                'self_harm',
                'other'
            )
        ),
    expert_severity text not null
        check (
            expert_severity in (
                'low',
                'medium',
                'high',
                'critical'
            )
        ),
    expert_child_role text not null
        check (
            expert_child_role in (
                'target',
                'participant',
                'initiator',
                'unknown'
            )
        ),
    expert_confidence real not null
        check (expert_confidence between 0 and 1),
    evidence_segment_refs text[] not null
        check (
            public.v2_valid_segment_refs(
                evidence_segment_refs
            )
        ),
    created_at timestamptz not null default now()
);

alter table public.v2_analyzer_capabilities
    enable row level security;
alter table public.v2_analyzer_capabilities
    force row level security;
alter table public.v2_incident_analysis_jobs
    enable row level security;
alter table public.v2_incident_analysis_jobs
    force row level security;
alter table public.v2_incident_analysis_details
    enable row level security;
alter table public.v2_incident_analysis_details
    force row level security;

create policy v2_guardians_read_confirmed_analysis_details
on public.v2_incident_analysis_details for select
to authenticated
using (
    public.v2_guardian_can_read_confirmed_incident(
        incident_id
    )
);

create trigger v2_incident_analysis_jobs_set_updated_at
before update on public.v2_incident_analysis_jobs
for each row execute function public.v2_set_updated_at();

create trigger v2_incident_analysis_details_immutable
before update or delete on public.v2_incident_analysis_details
for each row execute function public.v2_keep_analysis_immutable();

create or replace function public.v2_enqueue_incident_analysis_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.aad_version = 3 then
        insert into public.v2_incident_analysis_jobs (
            incident_id
        )
        values (new.incident_id)
        on conflict (incident_id) do nothing;
    end if;
    return new;
end;
$$;

create trigger v2_incident_context_enqueue_analysis
after insert on public.v2_incident_context
for each row execute function
    public.v2_enqueue_incident_analysis_job();

insert into public.v2_incident_analysis_jobs (incident_id)
select context.incident_id
from public.v2_incident_context context
join public.v2_safety_incidents incident
  on incident.id = context.incident_id
left join public.v2_incident_analysis analysis
  on analysis.incident_id = context.incident_id
where context.aad_version = 3
  and incident.status in ('received', 'analyzing')
  and analysis.incident_id is null
on conflict (incident_id) do nothing;

create or replace function public.v2_analyzer_capability_is_valid(
    target_capability_token text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        target_capability_token is not null
        and char_length(target_capability_token) between 32 and 256
        and exists (
            select 1
            from public.v2_analyzer_capabilities capability
            where capability.token_hash = extensions.digest(
                convert_to(target_capability_token, 'UTF8'),
                'sha256'
            )
              and capability.status = 'active'
              and capability.revoked_at is null
              and capability.not_before <= now()
              and capability.expires_at > now()
        );
$$;

create or replace function
public.v2_reap_incident_analysis_jobs_internal()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    candidate record;
    recovered_count integer := 0;
    is_expired_lease boolean;
    becomes_terminal boolean;
    effective_attempt_count integer;
    retry_ordinal integer;
    retry_delay_seconds integer;
    retry_at timestamptz;
    resolved_error_code text;
    resolved_failure_class text;
begin
    for candidate in
        select
            job.incident_id,
            job.state,
            job.attempt_count,
            job.outage_count,
            job.max_attempts,
            job.last_error_class,
            context.expires_at
        from public.v2_incident_analysis_jobs job
        join public.v2_incident_context context
          on context.incident_id = job.incident_id
        where (
            job.state = 'leased'
            and job.lease_expires_at <= now()
        ) or (
            job.state in ('pending', 'retry')
            and (
                job.attempt_count >= job.max_attempts
                or context.expires_at <=
                    now() + interval '30 seconds'
            )
        )
        order by
            coalesce(job.lease_expires_at, job.next_attempt_at),
            job.incident_id
        limit 100
        for update of job skip locked
    loop
        is_expired_lease := candidate.state = 'leased';
        effective_attempt_count := case
            when is_expired_lease then
                greatest(0, candidate.attempt_count - 1)
            else candidate.attempt_count
        end;
        becomes_terminal :=
            (
                not is_expired_lease
                and effective_attempt_count >= candidate.max_attempts
            )
            or candidate.expires_at <=
                now() + interval '30 seconds';
        resolved_error_code := case
            when candidate.expires_at <=
                now() + interval '30 seconds'
                then 'incident_context_expired'
            when becomes_terminal
                then 'analysis_attempts_exhausted'
            else 'analysis_lease_expired'
        end;
        resolved_failure_class := case
            when resolved_error_code = 'analysis_attempts_exhausted'
                then 'analysis'
            when is_expired_lease
                then 'worker_transient'
            else coalesce(
                candidate.last_error_class,
                'worker_transient'
            )
        end;
        retry_ordinal := least(
            10000,
            candidate.outage_count +
                case when is_expired_lease then 1 else 0 end
        );
        retry_delay_seconds :=
            least(
                1800,
                (
                    120 * power(
                        2::double precision,
                        least(greatest(retry_ordinal, 1) - 1, 4)
                    )
                )::integer
            ) + (
                get_byte(
                    extensions.digest(
                        convert_to(
                            candidate.incident_id::text || ':' ||
                                resolved_error_code || ':' ||
                                greatest(retry_ordinal, 1)::text,
                            'UTF8'
                        ),
                        'sha256'
                    ),
                    0
                ) % 61
            );
        retry_at := now() +
            make_interval(secs => retry_delay_seconds);

        update public.v2_incident_analysis_jobs job
           set state = case
                    when becomes_terminal then 'terminal_failed'
                    else 'retry'
               end,
               next_attempt_at = case
                    when becomes_terminal then job.next_attempt_at
                    else retry_at
               end,
               attempt_count = effective_attempt_count,
               outage_count = least(
                    10000,
                    job.outage_count +
                        case when is_expired_lease then 1 else 0 end
               ),
               lease_owner = null,
               lease_token_hash = null,
               lease_expires_at = null,
               last_error_code = resolved_error_code,
               last_error_class = resolved_failure_class,
               terminal_at = case
                    when becomes_terminal then now()
                    else null
               end
         where job.incident_id = candidate.incident_id;

        if becomes_terminal then
            update public.v2_safety_incidents incident
               set status = 'analysis_failed'
             where incident.id = candidate.incident_id
               and incident.status in ('received', 'analyzing');
        end if;

        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            object_id,
            outcome,
            metadata
        )
        values (
            'system',
            'v2.incident.analysis.reap',
            'safety_incident',
            candidate.incident_id,
            case when becomes_terminal then 'failed' else 'success' end,
            jsonb_build_object(
                'state',
                case
                    when becomes_terminal then 'terminal_failed'
                    else 'retry'
                end,
                'error_code',
                resolved_error_code,
                'failure_class',
                resolved_failure_class,
                'attempt_refunded',
                is_expired_lease,
                'retry_delay_seconds',
                case when becomes_terminal then null else retry_delay_seconds end
            )
        );

        recovered_count := recovered_count + 1;
    end loop;

    return recovered_count;
end;
$$;

create or replace function public.v2_claim_incident_analysis_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_seconds integer
)
returns table (
    incident_id uuid,
    lease_token text,
    client_incident_id uuid,
    device_id uuid,
    child_id uuid,
    category text,
    severity text,
    child_role text,
    confidence_canonical text,
    capture_quality_canonical text,
    occurred_at_canonical text,
    model_contract_version smallint,
    privacy_contract_version smallint,
    privacy_identity_version bigint,
    aad_version smallint,
    encryption_algorithm text,
    key_version integer,
    message_count smallint,
    lease_expires_at_canonical text,
    context_expires_at_canonical text,
    encrypted_payload_base64 text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    claimed_incident_id uuid;
    raw_lease_token text;
begin
    if not public.v2_analyzer_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_analyzer_capability'
            using errcode = '42501';
    end if;

    if target_worker_id is null
       or target_lease_seconds is null
       or target_lease_seconds not between 30 and 300 then
        raise exception 'invalid_analysis_lease'
            using errcode = '22023';
    end if;

    perform public.v2_reap_incident_analysis_jobs_internal();

    select job.incident_id
      into claimed_incident_id
      from public.v2_incident_analysis_jobs job
      join public.v2_safety_incidents incident
        on incident.id = job.incident_id
      join public.v2_incident_context context
        on context.incident_id = job.incident_id
      left join public.v2_incident_analysis analysis
        on analysis.incident_id = job.incident_id
     where context.aad_version = 3
       and incident.model_contract_version = 2
       and context.expires_at >
            now() +
                make_interval(secs => target_lease_seconds) +
                interval '30 seconds'
       and incident.status in ('received', 'analyzing')
       and analysis.incident_id is null
       and job.attempt_count < job.max_attempts
       and job.state in ('pending', 'retry')
       and job.next_attempt_at <= now()
     order by
        case incident.severity
            when 'critical' then 0
            when 'high' then 1
            when 'medium' then 2
            else 3
        end,
        incident.received_at,
        incident.id
     limit 1
     for update of job skip locked;

    if claimed_incident_id is null then
        return;
    end if;

    raw_lease_token := encode(
        extensions.gen_random_bytes(32),
        'hex'
    );

    update public.v2_incident_analysis_jobs job
       set state = 'leased',
           attempt_count = job.attempt_count + 1,
           lease_owner = target_worker_id,
           lease_token_hash = extensions.digest(
                convert_to(raw_lease_token, 'UTF8'),
                'sha256'
           ),
           lease_expires_at =
                least(
                    now() +
                        make_interval(
                            secs => target_lease_seconds
                        ),
                    (
                        select context.expires_at -
                            interval '30 seconds'
                        from public.v2_incident_context context
                        where context.incident_id =
                            claimed_incident_id
                    )
                ),
           last_error_code = null,
           last_error_class = null
     where job.incident_id = claimed_incident_id;

    update public.v2_safety_incidents incident
       set status = 'analyzing'
     where incident.id = claimed_incident_id
       and incident.status = 'received';

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        'service',
        'v2.incident.analysis.claim',
        'safety_incident',
        claimed_incident_id,
        'success',
        jsonb_build_object(
            'worker_id',
            target_worker_id
        )
    );

    return query
    select
        incident.id,
        raw_lease_token,
        incident.client_incident_id,
        incident.device_id,
        incident.child_id,
        incident.category,
        incident.severity,
        incident.child_role,
        to_char(
            incident.confidence,
            'FM0.000000'
        ),
        to_char(
            incident.capture_quality,
            'FM0.000000'
        ),
        to_char(
            incident.occurred_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        incident.model_contract_version,
        incident.privacy_contract_version,
        context.privacy_identity_version,
        context.aad_version,
        context.encryption_algorithm,
        context.key_version,
        context.message_count,
        to_char(
            job.lease_expires_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        to_char(
            context.expires_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ),
        encode(context.encrypted_payload, 'base64')
    from public.v2_safety_incidents incident
    join public.v2_incident_context context
      on context.incident_id = incident.id
    join public.v2_incident_analysis_jobs job
      on job.incident_id = incident.id
    where incident.id = claimed_incident_id;
end;
$$;

create or replace function public.v2_finalize_incident_analysis_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_token text,
    target_incident_id uuid,
    target_outcome text,
    target_reason_code text,
    target_action_code text,
    target_model_version text,
    target_expert_category text,
    target_expert_severity text,
    target_expert_child_role text,
    target_expert_confidence real,
    target_evidence_segment_refs text[]
)
returns table (
    incident_status text,
    analysis_outcome text,
    delivery_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    job_row public.v2_incident_analysis_jobs%rowtype;
    finalized record;
    details_row public.v2_incident_analysis_details%rowtype;
    completion_hash bytea;
begin
    if not public.v2_analyzer_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_analyzer_capability'
            using errcode = '42501';
    end if;

    if target_lease_token is null
       or char_length(target_lease_token) <> 64
       or target_worker_id is null
       or target_model_version is null
       or target_model_version not in (
            'gpt-5.4-nano',
            'gpt-5.4-nano-2026-03-17'
       )
       or target_outcome is null
       or target_outcome not in ('confirmed', 'dismissed')
       or target_reason_code is null
       or target_reason_code not in (
            'bullying_pattern',
            'exclusion_pattern',
            'sexual_risk',
            'violence_risk',
            'grooming_risk',
            'manipulation_risk',
            'stranger_contact_risk',
            'self_harm_risk',
            'other_safety_risk',
            'no_actionable_risk'
       )
       or target_action_code is null
       or target_action_code not in (
            'supportive_conversation',
            'preserve_and_report',
            'restrict_contact',
            'professional_support',
            'urgent_intervention',
            'no_action'
       )
       or target_expert_category is null
       or target_expert_category not in (
            'bullying',
            'exclusion',
            'sexual_content',
            'violence',
            'grooming',
            'manipulation',
            'stranger_contact',
            'self_harm',
            'other'
       )
       or target_expert_severity is null
       or target_expert_severity not in (
            'low',
            'medium',
            'high',
            'critical'
       )
       or target_expert_child_role is null
       or target_expert_child_role not in (
            'target',
            'participant',
            'initiator',
            'unknown'
       )
       or target_expert_confidence is null
       or target_expert_confidence not between 0 and 1
       or not public.v2_reason_matches_category(
            target_outcome,
            target_expert_category,
            target_reason_code
       )
       or not public.v2_action_matches_severity(
            target_outcome,
            target_expert_severity,
            target_action_code
       )
       or not public.v2_valid_segment_refs(
            target_evidence_segment_refs
       ) then
        raise exception 'invalid_expert_analysis'
            using errcode = '22023';
    end if;

    completion_hash := extensions.digest(
        convert_to(
            jsonb_build_object(
                'outcome',
                target_outcome,
                'reason_code',
                target_reason_code,
                'action_code',
                target_action_code,
                'model_version',
                target_model_version,
                'expert_category',
                target_expert_category,
                'expert_severity',
                target_expert_severity,
                'expert_child_role',
                target_expert_child_role,
                'expert_confidence',
                to_char(
                    target_expert_confidence,
                    'FM0.000000'
                ),
                'evidence_segment_refs',
                to_jsonb(target_evidence_segment_refs)
            )::text,
            'UTF8'
        ),
        'sha256'
    );

    select job.*
      into job_row
      from public.v2_incident_analysis_jobs job
     where job.incident_id = target_incident_id
     for update;

    if not found then
        raise exception 'invalid_or_expired_analysis_lease'
            using errcode = '42501';
    end if;

    if job_row.state = 'completed' then
        if job_row.completion_lease_token_hash
            is distinct from extensions.digest(
                convert_to(target_lease_token, 'UTF8'),
                'sha256'
            ) then
            raise exception 'invalid_or_expired_analysis_lease'
                using errcode = '42501';
        end if;

        if job_row.completion_request_hash
            is distinct from completion_hash then
            raise exception 'incident_analysis_completion_conflict'
                using errcode = '23505';
        end if;

        return query
        select
            job_row.completion_incident_status,
            job_row.completion_analysis_outcome,
            job_row.completion_delivery_count;
        return;
    end if;

    if job_row.state <> 'leased'
       or job_row.lease_owner is distinct from target_worker_id
       or job_row.lease_expires_at <= now()
       or job_row.lease_token_hash is distinct from
            extensions.digest(
                convert_to(target_lease_token, 'UTF8'),
                'sha256'
            ) then
        raise exception 'invalid_or_expired_analysis_lease'
            using errcode = '42501';
    end if;

    select *
      into finalized
      from public.v2_finalize_incident_analysis_internal(
        target_incident_id,
        target_outcome,
        target_reason_code,
        target_action_code,
        target_expert_category,
        'openai',
        'gpt-5.4-nano',
        target_model_version,
        'kippy-expert-v2',
        2::smallint
      );

    insert into public.v2_incident_analysis_details (
        incident_id,
        expert_category,
        expert_severity,
        expert_child_role,
        expert_confidence,
        evidence_segment_refs
    )
    values (
        target_incident_id,
        target_expert_category,
        target_expert_severity,
        target_expert_child_role,
        target_expert_confidence,
        target_evidence_segment_refs
    )
    on conflict (incident_id) do nothing;

    select details.*
      into details_row
      from public.v2_incident_analysis_details details
     where details.incident_id = target_incident_id;

    if details_row.expert_category <> target_expert_category
       or details_row.expert_severity <> target_expert_severity
       or details_row.expert_child_role <> target_expert_child_role
       or details_row.expert_confidence
            <> target_expert_confidence
       or details_row.evidence_segment_refs
            <> target_evidence_segment_refs then
        raise exception 'incident_analysis_details_conflict'
            using errcode = '23505';
    end if;

    update public.v2_incident_analysis_jobs job
       set state = 'completed',
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null,
           completed_at = now(),
           terminal_at = null,
           last_error_code = null,
           last_error_class = null,
           completion_request_hash = completion_hash,
           completion_lease_token_hash =
                job.lease_token_hash,
           completion_incident_status =
                finalized.incident_status,
           completion_analysis_outcome =
                finalized.analysis_outcome,
           completion_delivery_count =
                finalized.delivery_count
     where job.incident_id = target_incident_id;

    return query
    select
        finalized.incident_status::text,
        finalized.analysis_outcome::text,
        finalized.delivery_count::integer;
end;
$$;

create or replace function public.v2_record_incident_analysis_failure_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_token text,
    target_incident_id uuid,
    target_error_code text,
    target_failure_class text,
    target_retryable boolean
)
returns table (
    job_state text,
    attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    job_row public.v2_incident_analysis_jobs%rowtype;
    can_retry boolean;
    is_outage boolean;
    effective_attempt_count integer;
    retry_ordinal integer;
    retry_delay_seconds integer;
    retry_at timestamptz;
    context_expires_at timestamptz;
begin
    if not public.v2_analyzer_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_analyzer_capability'
            using errcode = '42501';
    end if;

    if target_lease_token is null
       or char_length(target_lease_token) <> 64
       or target_error_code is null
       or target_error_code !~ '^[a-z0-9_]{1,80}$'
       or target_failure_class is null
       or target_failure_class not in (
            'provider_transient',
            'configuration',
            'worker_transient',
            'analysis'
       )
       or target_retryable is null then
        raise exception 'invalid_analysis_failure'
            using errcode = '22023';
    end if;

    select job.*
      into job_row
      from public.v2_incident_analysis_jobs job
     where job.incident_id = target_incident_id
     for update;

    if not found
       or job_row.state <> 'leased'
       or job_row.lease_owner is distinct from target_worker_id
       or job_row.lease_expires_at <= now()
       or job_row.lease_token_hash is distinct from
            extensions.digest(
                convert_to(target_lease_token, 'UTF8'),
                'sha256'
            ) then
        raise exception 'invalid_or_expired_analysis_lease'
            using errcode = '42501';
    end if;

    select context.expires_at
      into context_expires_at
      from public.v2_incident_context context
     where context.incident_id = target_incident_id;

    is_outage := target_failure_class in (
        'provider_transient',
        'configuration',
        'worker_transient'
    );
    effective_attempt_count := case
        when is_outage then
            greatest(0, job_row.attempt_count - 1)
        else job_row.attempt_count
    end;
    retry_ordinal := case
        when is_outage then least(job_row.outage_count + 1, 10000)
        else greatest(1, effective_attempt_count)
    end;
    retry_delay_seconds :=
        least(
            1800,
            (
                120 * power(
                    2::double precision,
                    least(retry_ordinal - 1, 4)
                )
            )::integer
        ) + (
            get_byte(
                extensions.digest(
                    convert_to(
                        target_incident_id::text || ':' ||
                            target_error_code || ':' ||
                            retry_ordinal::text,
                        'UTF8'
                    ),
                    'sha256'
                ),
                0
            ) % 61
        );
    retry_at := now() +
        make_interval(secs => retry_delay_seconds);
    can_retry :=
        (target_retryable or is_outage)
        and (
            is_outage
            or effective_attempt_count < job_row.max_attempts
        )
        and retry_at <
            context_expires_at - interval '30 seconds';

    update public.v2_incident_analysis_jobs job
       set state = case
                when can_retry then 'retry'
                else 'terminal_failed'
           end,
           next_attempt_at = case
                when can_retry then retry_at
                else job.next_attempt_at
           end,
           attempt_count = effective_attempt_count,
           outage_count = least(
                10000,
                job.outage_count +
                    case when is_outage then 1 else 0 end
           ),
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null,
           last_error_code = target_error_code,
           last_error_class = target_failure_class,
           terminal_at = case
                when can_retry then null
                else now()
           end
     where job.incident_id = target_incident_id;

    if not can_retry then
        update public.v2_safety_incidents incident
           set status = 'analysis_failed'
         where incident.id = target_incident_id
           and incident.status in ('received', 'analyzing');
    end if;

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        'service',
        'v2.incident.analysis.failure',
        'safety_incident',
        target_incident_id,
        'failed',
        jsonb_build_object(
            'error_code',
            target_error_code,
            'retryable',
            can_retry,
            'failure_class',
            target_failure_class,
            'retry_delay_seconds',
            case when can_retry then retry_delay_seconds end
        )
    );

    return query
    select job.state, job.attempt_count
    from public.v2_incident_analysis_jobs job
    where job.incident_id = target_incident_id;
end;
$$;

-- Expiry removes the complete incident subtree. Deleting the parent incident
-- lets the existing immutable-analysis trigger distinguish retention from an
-- attempted direct mutation, while ON DELETE CASCADE physically removes
-- ciphertext, jobs, expert details, analysis and delivery rows.
create or replace function
public.v2_delete_expired_incident_context_service(
    requested_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    deleted_count integer;
begin
    if requested_limit is null
       or requested_limit not between 1 and 5000 then
        raise exception 'invalid_retention_batch_limit'
            using errcode = '22023';
    end if;

    with expired as (
        select context.incident_id
        from public.v2_incident_context context
        where context.expires_at <= now()
        order by context.expires_at, context.incident_id
        limit requested_limit
        for update skip locked
    )
    delete from public.v2_safety_incidents incident
    using expired
    where incident.id = expired.incident_id;

    get diagnostics deleted_count = row_count;

    if deleted_count > 0 then
        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            outcome,
            metadata
        )
        values (
            'system',
            'v2.incident_data.retention',
            'safety_incident',
            'success',
            jsonb_build_object(
                'deleted_count',
                deleted_count
            )
        );
    end if;

    return deleted_count;
end;
$$;

revoke all on table
    public.v2_analyzer_capabilities,
    public.v2_incident_analysis_jobs,
    public.v2_incident_analysis_details
from public, anon, authenticated, service_role;

revoke all on function
    public.v2_valid_segment_refs(text[]),
    public.v2_enqueue_incident_analysis_job(),
    public.v2_analyzer_capability_is_valid(text),
    public.v2_reap_incident_analysis_jobs_internal(),
    public.v2_claim_incident_analysis_service(
        text,
        uuid,
        integer
    ),
    public.v2_finalize_incident_analysis_service(
        text,
        uuid,
        text,
        uuid,
        text,
        text,
        text,
        text,
        text,
        text,
        text,
        real,
        text[]
    ),
    public.v2_record_incident_analysis_failure_service(
        text,
        uuid,
        text,
        uuid,
        text,
        text,
        boolean
    ),
    public.v2_delete_expired_incident_context_service(integer)
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_claim_incident_analysis_service(
        text,
        uuid,
        integer
    ),
    public.v2_finalize_incident_analysis_service(
        text,
        uuid,
        text,
        uuid,
        text,
        text,
        text,
        text,
        text,
        text,
        text,
        real,
        text[]
    ),
    public.v2_record_incident_analysis_failure_service(
        text,
        uuid,
        text,
        uuid,
        text,
        text,
        boolean
    ),
    public.v2_delete_expired_incident_context_service(integer)
to service_role;

grant select on table public.v2_incident_analysis_details
to authenticated;

commit;
