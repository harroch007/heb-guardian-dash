begin;

-- V3 keeps the model inference separate from the deterministic server policy.
-- Legacy V2 detail rows remain readable with inference_contract_version = 2;
-- only the V3 finalizer may create version 3 rows.
create or replace function public.v2_valid_expert_secondary_categories(
    target_primary_category text,
    target_secondary_categories text[]
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select
        target_secondary_categories is not null
        and cardinality(target_secondary_categories) between 0 and 8
        and cardinality(target_secondary_categories) = (
            select count(distinct category_value)
            from unnest(target_secondary_categories) as category_value
        )
        and not exists (
            select 1
            from unnest(target_secondary_categories) as category_value
            where category_value not in (
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
        )
        and (
            target_primary_category is not null
            or cardinality(target_secondary_categories) = 0
        )
        and (
            target_primary_category is null
            or not (
                target_primary_category =
                    any(target_secondary_categories)
            )
        );
$$;

create or replace function public.v2_v3_reason_for_inference(
    target_outcome text,
    target_primary_category text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case target_outcome
        when 'dismissed' then 'no_actionable_risk'
        when 'confirmed' then case target_primary_category
            when 'bullying' then 'bullying_pattern'
            when 'exclusion' then 'exclusion_pattern'
            when 'sexual_content' then 'sexual_risk'
            when 'violence' then 'violence_risk'
            when 'grooming' then 'grooming_risk'
            when 'manipulation' then 'manipulation_risk'
            when 'stranger_contact' then 'stranger_contact_risk'
            when 'self_harm' then 'self_harm_risk'
            when 'other' then 'other_safety_risk'
        end
    end;
$$;

create or replace function public.v2_v3_action_for_inference(
    target_outcome text,
    target_primary_category text,
    target_severity text,
    target_urgency text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case
        when target_outcome = 'dismissed' then 'no_action'
        when target_outcome <> 'confirmed' then null
        when target_urgency = 'immediate'
          or target_severity = 'critical'
            then 'urgent_intervention'
        when target_severity = 'high'
          and target_primary_category in (
            'grooming',
            'sexual_content',
            'stranger_contact'
          )
            then 'preserve_and_report'
        when target_severity = 'high'
            then 'professional_support'
        when target_primary_category in (
            'grooming',
            'manipulation',
            'stranger_contact'
        )
            then 'restrict_contact'
        when target_primary_category = 'self_harm'
            then 'professional_support'
        else 'supportive_conversation'
    end;
$$;

create or replace function public.v2_v3_channels_for_inference(
    target_outcome text,
    target_severity text,
    target_urgency text
)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
    select case
        when target_outcome = 'dismissed'
            then array[]::text[]
        when target_outcome = 'confirmed'
          and (
            target_urgency = 'immediate'
            or target_severity in ('high', 'critical')
          )
            then array['in_app', 'push']::text[]
        when target_outcome = 'confirmed'
            then array['in_app']::text[]
    end;
$$;

alter table public.v2_incident_analysis_details
    alter column expert_category drop not null,
    alter column expert_severity drop not null,
    add column secondary_categories text[],
    add column expert_urgency text,
    add column expert_pattern text,
    add column inference_contract_version smallint
        not null default 2,
    add column policy_channels text[];

alter table public.v2_incident_analysis_details
    add constraint v2_incident_analysis_details_contract_version_check
        check (inference_contract_version in (2, 3)),
    add constraint v2_incident_analysis_details_v3_shape_check
        check (
            inference_contract_version = 2
            or (
                public.v2_valid_expert_secondary_categories(
                    expert_category,
                    secondary_categories
                )
                and expert_urgency is not null
                and expert_urgency in (
                    'routine',
                    'elevated',
                    'immediate'
                )
                and expert_pattern is not null
                and expert_pattern in (
                    'isolated',
                    'repeated',
                    'escalating',
                    'unknown'
                )
                and policy_channels is not null
                and (
                    policy_channels = array[]::text[]
                    or policy_channels = array['in_app']::text[]
                    or policy_channels =
                        array['in_app', 'push']::text[]
                )
            )
        );

comment on column
    public.v2_incident_analysis_details.secondary_categories is
    'V3 expert inference only; never controls parent routing directly.';
comment on column
    public.v2_incident_analysis_details.expert_urgency is
    'V3 expert urgency evidence: routine, elevated or immediate.';
comment on column
    public.v2_incident_analysis_details.expert_pattern is
    'V3 expert pattern evidence: isolated, repeated, escalating or unknown.';
comment on column
    public.v2_incident_analysis_details.policy_channels is
    'Canonical channels independently derived and verified by server policy. A row is an outbox intent, not proof of provider delivery.';

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
    target_secondary_categories text[],
    target_expert_severity text,
    target_expert_urgency text,
    target_expert_child_role text,
    target_expert_pattern text,
    target_expert_confidence real,
    target_evidence_segment_refs text[],
    target_policy_channels text[]
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
    total_delivery_count integer := 0;
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
       or target_expert_urgency is null
       or target_expert_urgency not in (
            'routine',
            'elevated',
            'immediate'
       )
       or target_expert_child_role is null
       or target_expert_child_role not in (
            'target',
            'participant',
            'initiator',
            'unknown'
       )
       or target_expert_pattern is null
       or target_expert_pattern not in (
            'isolated',
            'repeated',
            'escalating',
            'unknown'
       )
       or target_expert_confidence is null
       or target_expert_confidence not between 0 and 1
       or not public.v2_valid_segment_refs(
            target_evidence_segment_refs
       )
       or not public.v2_valid_expert_secondary_categories(
            target_expert_category,
            target_secondary_categories
       )
       or target_reason_code is distinct from
            public.v2_v3_reason_for_inference(
                target_outcome,
                target_expert_category
            )
       or target_action_code is distinct from
            public.v2_v3_action_for_inference(
                target_outcome,
                target_expert_category,
                target_expert_severity,
                target_expert_urgency
            )
       or target_policy_channels is distinct from
            public.v2_v3_channels_for_inference(
                target_outcome,
                target_expert_severity,
                target_expert_urgency
            )
       or (
            target_outcome = 'confirmed'
            and (
                target_expert_category is null
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
                or target_expert_confidence < 0.6
            )
       )
       or (
            target_outcome = 'dismissed'
            and (
                target_expert_category is not null
                or cardinality(target_secondary_categories) <> 0
                or target_expert_severity is not null
                or target_expert_urgency <> 'routine'
                or target_expert_child_role <> 'unknown'
                or cardinality(target_policy_channels) <> 0
            )
       ) then
        raise exception 'invalid_expert_v3_analysis'
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
                'secondary_categories',
                to_jsonb(target_secondary_categories),
                'expert_severity',
                target_expert_severity,
                'expert_urgency',
                target_expert_urgency,
                'expert_child_role',
                target_expert_child_role,
                'expert_pattern',
                target_expert_pattern,
                'expert_confidence',
                to_char(
                    target_expert_confidence,
                    'FM0.000000'
                ),
                'evidence_segment_refs',
                to_jsonb(target_evidence_segment_refs),
                'policy_channels',
                to_jsonb(target_policy_channels),
                'inference_contract_version',
                3
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
        coalesce(target_expert_category, 'other'),
        'openai',
        'gpt-5.4-nano',
        target_model_version,
        'kippy-expert-v3',
        2::smallint
      );

    insert into public.v2_incident_analysis_details (
        incident_id,
        expert_category,
        secondary_categories,
        expert_severity,
        expert_urgency,
        expert_child_role,
        expert_pattern,
        expert_confidence,
        evidence_segment_refs,
        inference_contract_version,
        policy_channels
    )
    values (
        target_incident_id,
        target_expert_category,
        target_secondary_categories,
        target_expert_severity,
        target_expert_urgency,
        target_expert_child_role,
        target_expert_pattern,
        target_expert_confidence,
        target_evidence_segment_refs,
        3,
        target_policy_channels
    )
    on conflict (incident_id) do nothing;

    select details.*
      into details_row
      from public.v2_incident_analysis_details details
     where details.incident_id = target_incident_id;

    if details_row.expert_category
            is distinct from target_expert_category
       or details_row.secondary_categories
            is distinct from target_secondary_categories
       or details_row.expert_severity
            is distinct from target_expert_severity
       or details_row.expert_urgency
            is distinct from target_expert_urgency
       or details_row.expert_child_role
            is distinct from target_expert_child_role
       or details_row.expert_pattern
            is distinct from target_expert_pattern
       or details_row.expert_confidence
            is distinct from target_expert_confidence
       or details_row.evidence_segment_refs
            is distinct from target_evidence_segment_refs
       or details_row.inference_contract_version <> 3
       or details_row.policy_channels
            is distinct from target_policy_channels then
        raise exception 'incident_analysis_v3_details_conflict'
            using errcode = '23505';
    end if;

    if target_outcome = 'confirmed' then
        insert into public.v2_alert_deliveries (
            incident_id,
            guardian_user_id,
            channel,
            idempotency_key
        )
        select
            target_incident_id,
            membership.guardian_user_id,
            selected_channel.channel,
            'v3:' || target_incident_id::text || ':' ||
                membership.guardian_user_id::text || ':' ||
                selected_channel.channel
        from public.v2_safety_incidents incident
        join public.v2_children child
          on child.id = incident.child_id
        join public.v2_guardian_memberships membership
          on membership.family_id = child.family_id
         and membership.status = 'active'
        cross join unnest(target_policy_channels)
            as selected_channel(channel)
        where incident.id = target_incident_id
        on conflict (
            incident_id,
            guardian_user_id,
            channel
        ) do nothing;
    end if;

    select count(*)::integer
      into total_delivery_count
      from public.v2_alert_deliveries delivery
     where delivery.incident_id = target_incident_id;

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
                total_delivery_count
     where job.incident_id = target_incident_id;

    return query
    select
        finalized.incident_status::text,
        finalized.analysis_outcome::text,
        total_delivery_count;
end;
$$;

-- The legacy finalizer cannot persist the V3 inference or independently
-- verify its routing decision. Removing the obsolete overload also preserves
-- the repository-wide invariant that every remaining *_service RPC is
-- executable by service_role and protected by its own authorization boundary.
drop function public.v2_finalize_incident_analysis_service(
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
);

revoke all on function public.v2_finalize_incident_analysis_service(
    text,
    uuid,
    text,
    uuid,
    text,
    text,
    text,
    text,
    text,
    text[],
    text,
    text,
    text,
    text,
    real,
    text[],
    text[]
)
from public, anon, authenticated, service_role;

grant execute on function public.v2_finalize_incident_analysis_service(
    text,
    uuid,
    text,
    uuid,
    text,
    text,
    text,
    text,
    text,
    text[],
    text,
    text,
    text,
    text,
    real,
    text[],
    text[]
)
to service_role;

revoke all on function
    public.v2_valid_expert_secondary_categories(text, text[]),
    public.v2_v3_reason_for_inference(text, text),
    public.v2_v3_action_for_inference(text, text, text, text),
    public.v2_v3_channels_for_inference(text, text, text)
from public, anon, authenticated, service_role;

commit;
