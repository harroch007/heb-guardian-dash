begin;

-- Restore the canonical retry behavior without weakening the incident state
-- machine: releasing a lease makes only the content-free receipt retryable.
-- The incident remains analyzing because analyzing -> received is forbidden,
-- and the next lease acquisition safely performs analyzing -> analyzing.
create or replace function public.v2_release_ephemeral_incident_analysis_service(
    target_incident_id uuid,
    target_lease_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    released_count integer;
begin
    if target_lease_token is null or char_length(target_lease_token) <> 64 then
        return false;
    end if;

    update public.v2_ephemeral_incident_receipts receipt
       set state = 'received',
           lease_token_hash = null,
           lease_expires_at = null
     where receipt.incident_id = target_incident_id
       and receipt.state = 'leased'
       and receipt.lease_token_hash = extensions.digest(
           convert_to(target_lease_token, 'UTF8'),
           'sha256'
       );

    get diagnostics released_count = row_count;
    return released_count = 1;
end;
$$;

comment on function public.v2_release_ephemeral_incident_analysis_service(
    uuid, text
) is
    'Releases a V3 ephemeral receipt lease for immediate retry without rewinding the canonical incident state machine.';

-- Preserve the V3 privacy and expert-validation boundary introduced by
-- 20260828100000 while restoring the immutable 15-argument v4 compatibility
-- path established by 20260816090000. The additive 16-argument v5 overload is
-- deliberately left untouched.
create or replace function public.v2_finalize_ephemeral_incident_analysis_service(
    target_incident_id uuid,
    target_lease_token text,
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
    receipt_row public.v2_ephemeral_incident_receipts%rowtype;
    finalized record;
    details_row public.v2_incident_analysis_details%rowtype;
    completion_hash bytea;
    total_delivery_count integer := 0;
begin
    if target_lease_token is null
       or char_length(target_lease_token) <> 64
       or target_model_version is null
       or target_model_version not in (
            'gpt-5.4-nano',
            'gpt-5.4-nano-2026-03-17',
            'gpt-5.6-luna'
       )
       or target_outcome is null
       or target_outcome not in ('confirmed', 'dismissed')
       or target_expert_urgency not in ('routine', 'elevated', 'immediate')
       or target_expert_child_role not in ('target', 'participant', 'initiator', 'unknown')
       or target_expert_pattern not in ('isolated', 'repeated', 'escalating', 'unknown')
       or target_expert_confidence is null
       or target_expert_confidence not between 0 and 1
       or not public.v2_valid_segment_refs(target_evidence_segment_refs)
       or not public.v2_valid_expert_secondary_categories(
            target_expert_category,
            target_secondary_categories
       )
       or target_reason_code is distinct from public.v2_v3_reason_for_inference(
            target_outcome,
            target_expert_category
       )
       or target_action_code is distinct from public.v2_v3_action_for_inference(
            target_outcome,
            target_expert_category,
            target_expert_severity,
            target_expert_urgency
       )
       or target_policy_channels is distinct from public.v2_v3_channels_for_inference(
            target_outcome,
            target_expert_severity,
            target_expert_urgency
       )
       or (
            target_outcome = 'confirmed'
            and (
                target_expert_category is null
                or target_expert_category not in (
                    'bullying', 'exclusion', 'sexual_content', 'violence',
                    'grooming', 'manipulation', 'stranger_contact', 'self_harm', 'other'
                )
                or target_expert_severity not in ('low', 'medium', 'high', 'critical')
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
        raise exception 'invalid_expert_v3_analysis' using errcode = '22023';
    end if;

    completion_hash := extensions.digest(
        convert_to(
            jsonb_build_object(
                'outcome', target_outcome,
                'reason_code', target_reason_code,
                'action_code', target_action_code,
                'model_version', target_model_version,
                'expert_category', target_expert_category,
                'secondary_categories', to_jsonb(target_secondary_categories),
                'expert_severity', target_expert_severity,
                'expert_urgency', target_expert_urgency,
                'expert_child_role', target_expert_child_role,
                'expert_pattern', target_expert_pattern,
                'expert_confidence', to_char(target_expert_confidence, 'FM0.000000'),
                'evidence_segment_refs', to_jsonb(target_evidence_segment_refs),
                'policy_channels', to_jsonb(target_policy_channels),
                'inference_contract_version', 3
            )::text,
            'UTF8'
        ),
        'sha256'
    );

    select receipt.*
      into receipt_row
      from public.v2_ephemeral_incident_receipts receipt
     where receipt.incident_id = target_incident_id
     for update;

    if receipt_row.incident_id is null then
        raise exception 'invalid_or_expired_analysis_lease' using errcode = '42501';
    end if;

    if receipt_row.state = 'completed' then
        if receipt_row.completion_lease_token_hash is distinct from extensions.digest(
            convert_to(target_lease_token, 'UTF8'),
            'sha256'
        ) then
            raise exception 'invalid_or_expired_analysis_lease' using errcode = '42501';
        end if;
        if receipt_row.completion_request_hash is distinct from completion_hash then
            raise exception 'incident_analysis_completion_conflict' using errcode = '23505';
        end if;
        return query select
            receipt_row.completion_incident_status,
            receipt_row.completion_analysis_outcome,
            receipt_row.completion_delivery_count;
        return;
    end if;

    if receipt_row.state <> 'leased'
       or receipt_row.context_expires_at <= now()
       or receipt_row.lease_expires_at <= now()
       or receipt_row.lease_token_hash is distinct from extensions.digest(
            convert_to(target_lease_token, 'UTF8'),
            'sha256'
       ) then
        raise exception 'invalid_or_expired_analysis_lease' using errcode = '42501';
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
        case target_model_version
            when 'gpt-5.6-luna' then 'gpt-5.6-luna'
            else 'gpt-5.4-nano'
        end,
        target_model_version,
        'kippy-expert-v4',
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
    ) values (
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
    ) on conflict (incident_id) do nothing;

    select details.*
      into details_row
      from public.v2_incident_analysis_details details
     where details.incident_id = target_incident_id;

    if details_row.expert_category is distinct from target_expert_category
       or details_row.secondary_categories is distinct from target_secondary_categories
       or details_row.expert_severity is distinct from target_expert_severity
       or details_row.expert_urgency is distinct from target_expert_urgency
       or details_row.expert_child_role is distinct from target_expert_child_role
       or details_row.expert_pattern is distinct from target_expert_pattern
       or details_row.expert_confidence is distinct from target_expert_confidence
       or details_row.evidence_segment_refs is distinct from target_evidence_segment_refs
       or details_row.inference_contract_version <> 3
       or details_row.policy_channels is distinct from target_policy_channels then
        raise exception 'incident_analysis_v3_details_conflict' using errcode = '23505';
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
                membership.guardian_user_id::text || ':' || selected_channel.channel
        from public.v2_safety_incidents incident
        join public.v2_children child on child.id = incident.child_id
        join public.v2_guardian_memberships membership
          on membership.family_id = child.family_id
         and membership.status = 'active'
        cross join unnest(target_policy_channels) as selected_channel(channel)
        where incident.id = target_incident_id
        on conflict (incident_id, guardian_user_id, channel) do nothing;
    end if;

    select count(*)::integer
      into total_delivery_count
      from public.v2_alert_deliveries delivery
     where delivery.incident_id = target_incident_id;

    update public.v2_ephemeral_incident_receipts receipt
       set state = 'completed',
           lease_token_hash = null,
           lease_expires_at = null,
           completion_request_hash = completion_hash,
           completion_lease_token_hash = receipt.lease_token_hash,
           completion_incident_status = finalized.incident_status,
           completion_analysis_outcome = finalized.analysis_outcome,
           completion_delivery_count = total_delivery_count,
           completed_at = now()
     where receipt.incident_id = target_incident_id;

    return query select
        finalized.incident_status::text,
        finalized.analysis_outcome::text,
        total_delivery_count;
end;
$$;

comment on function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) is
    'Immutable kippy-expert-v4 compatibility finalizer with the V3 ephemeral privacy and structured expert-result boundary.';

alter function public.v2_release_ephemeral_incident_analysis_service(uuid, text)
owner to postgres;

alter function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) owner to postgres;

revoke all on function public.v2_release_ephemeral_incident_analysis_service(
    uuid, text
) from public, anon, authenticated, service_role;

revoke all on function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) from public, anon, authenticated, service_role;

grant execute on function public.v2_release_ephemeral_incident_analysis_service(
    uuid, text
) to service_role;

grant execute on function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) to service_role;

do $$
declare
    release_definition text;
    v4_definition text;
    v5_definition text;
    required_v3_marker text;
begin
    release_definition := pg_get_functiondef(
        'public.v2_release_ephemeral_incident_analysis_service(uuid,text)'::regprocedure
    );
    v4_definition := pg_get_functiondef(
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])'::regprocedure
    );
    v5_definition := pg_get_functiondef(
        'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[],text)'::regprocedure
    );

    if position('v2_safety_incidents' in release_definition) > 0 then
        raise exception 'ephemeral_release_must_not_rewind_incident_status';
    end if;

    if position('kippy-expert-v4' in v4_definition) = 0
       or position('kippy-expert-v3' in v4_definition) > 0
       or position('target_prompt_version' in v4_definition) > 0 then
        raise exception 'unexpected_v4_ephemeral_finalizer_definition';
    end if;

    foreach required_v3_marker in array array[
        'v2_valid_segment_refs',
        'v2_valid_expert_secondary_categories',
        'v2_v3_reason_for_inference',
        'v2_v3_action_for_inference',
        'v2_v3_channels_for_inference',
        'v2_incident_analysis_details',
        'inference_contract_version'
    ] loop
        if position(required_v3_marker in v4_definition) = 0 then
            raise exception 'v4_finalizer_missing_v3_hardening:%',
                required_v3_marker;
        end if;
    end loop;

    if position('v2_incident_context' in v4_definition) > 0
       or position('v2_incident_analysis_jobs' in v4_definition) > 0 then
        raise exception 'v4_finalizer_must_not_persist_raw_context';
    end if;

    if position('kippy-expert-v5' in v5_definition) = 0
       or position('target_prompt_version' in v5_definition) = 0 then
        raise exception 'v5_ephemeral_finalizer_was_not_preserved';
    end if;
end
$$;

commit;
