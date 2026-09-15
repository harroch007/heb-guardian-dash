begin;

-- Privacy contract v1 is the legacy sanitized FIFO. V2 adds bounded,
-- non-identifying safety_context and keeps the encrypted-at-rest analysis
-- queue. V3 keeps the V2 plaintext shape but its envelope may only exist in
-- Edge memory while the expert runs; only a content-free receipt is durable.
alter table public.v2_safety_incidents
    drop constraint if exists v2_safety_incidents_privacy_contract_version_check;

alter table public.v2_safety_incidents
    add constraint v2_safety_incidents_privacy_contract_version_check
    check (privacy_contract_version in (1, 2, 3));

comment on constraint v2_safety_incidents_privacy_contract_version_check
on public.v2_safety_incidents is
    'v1 is the legacy sanitized FIFO; v2 adds non-identifying safety_context and remains a stored encrypted envelope; v3 uses the v2 plaintext shape but is processed ephemerally.';

comment on table public.v2_incident_analysis is
    'Parent-safe expert analysis only. V1/v2 context remains encrypted in v2_incident_context; V3 context is processed ephemerally and is never inserted there.';

create or replace function public.v2_guard_incident_context_privacy_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.v2_safety_incidents incident
        where incident.id = new.incident_id
          and incident.privacy_contract_version in (1, 2)
    ) then
        raise exception 'v3_incident_context_must_be_ephemeral'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

drop trigger if exists v2_incident_context_guard_privacy_version
on public.v2_incident_context;

create trigger v2_incident_context_guard_privacy_version
before insert or update on public.v2_incident_context
for each row execute function public.v2_guard_incident_context_privacy_version();

-- Preserve both deployed stored-envelope contracts: V1 legacy shape and V2
-- shape with safety_context. V3 is deliberately not accepted here and must
-- use the ephemeral receipt RPC below.
create or replace function public.v2_submit_safety_incident_service(
    target_device_id uuid,
    target_client_incident_id uuid,
    target_category text,
    target_severity text,
    target_child_role text,
    target_confidence real,
    target_capture_quality real,
    target_occurred_at timestamptz,
    target_model_contract_version smallint,
    target_privacy_contract_version smallint,
    target_privacy_identity_version bigint,
    target_encrypted_payload_base64 text,
    target_encryption_algorithm text,
    target_key_version integer,
    target_message_count smallint,
    target_context_expires_at timestamptz
)
returns table (
    incident_id uuid,
    created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    resolved_child_id uuid;
    resolved_incident_id uuid;
    inserted_count integer;
    decoded_payload bytea;
begin
    select device.child_id
      into resolved_child_id
      from public.v2_protected_devices device
     where device.id = target_device_id
       and device.status in ('active', 'degraded');

    if resolved_child_id is null then
        raise exception 'device_not_active'
            using errcode = '42501';
    end if;

    if target_model_contract_version <> 2 then
        raise exception 'unsupported_incident_model_contract'
            using errcode = '22023';
    end if;

    if target_privacy_contract_version not in (1, 2)
       or target_privacy_identity_version < 1 then
        raise exception 'unsupported_incident_privacy_contract'
            using errcode = '22023';
    end if;

    begin
        decoded_payload := decode(
            target_encrypted_payload_base64,
            'base64'
        );
    exception
        when others then
            raise exception 'invalid_encrypted_payload'
                using errcode = '22023';
    end;

    if octet_length(decoded_payload) not between 1 and 8388608
       or char_length(target_encryption_algorithm) not between 3 and 40
       or target_context_expires_at <= now()
       or target_context_expires_at > now() + interval '7 days' then
        raise exception 'invalid_incident_context'
            using errcode = '22023';
    end if;

    insert into public.v2_safety_incidents (
        device_id,
        child_id,
        client_incident_id,
        category,
        severity,
        child_role,
        confidence,
        capture_quality,
        occurred_at,
        model_contract_version,
        privacy_contract_version
    ) values (
        target_device_id,
        resolved_child_id,
        target_client_incident_id,
        target_category,
        target_severity,
        target_child_role,
        target_confidence,
        target_capture_quality,
        target_occurred_at,
        target_model_contract_version,
        target_privacy_contract_version
    )
    on conflict (device_id, client_incident_id) do nothing
    returning id into resolved_incident_id;

    get diagnostics inserted_count = row_count;

    if inserted_count = 0 then
        select incident.id
          into resolved_incident_id
          from public.v2_safety_incidents incident
          join public.v2_incident_context context
            on context.incident_id = incident.id
         where incident.device_id = target_device_id
           and incident.client_incident_id = target_client_incident_id
           and incident.category = target_category
           and incident.severity = target_severity
           and incident.child_role = target_child_role
           and incident.confidence = target_confidence
           and incident.capture_quality = target_capture_quality
           and incident.occurred_at = target_occurred_at
           and incident.model_contract_version = target_model_contract_version
           and incident.privacy_contract_version = target_privacy_contract_version
           and context.encrypted_payload = decoded_payload
           and context.encryption_algorithm = target_encryption_algorithm
           and context.key_version = target_key_version
           and context.message_count = target_message_count
           and context.privacy_identity_version = target_privacy_identity_version
           and context.expires_at = target_context_expires_at;

        if resolved_incident_id is null then
            raise exception 'incident_idempotency_conflict'
                using errcode = '23505';
        end if;
    else
        insert into public.v2_incident_context (
            incident_id,
            encrypted_payload,
            encryption_algorithm,
            key_version,
            message_count,
            privacy_identity_version,
            expires_at
        ) values (
            resolved_incident_id,
            decoded_payload,
            target_encryption_algorithm,
            target_key_version,
            target_message_count,
            target_privacy_identity_version,
            target_context_expires_at
        );

        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            object_id,
            outcome,
            metadata
        ) values (
            'device',
            'v2.incident.submit',
            'safety_incident',
            resolved_incident_id,
            'success',
            jsonb_build_object(
                'privacy_contract_version', target_privacy_contract_version,
                'privacy_identity_version', target_privacy_identity_version
            )
        );
    end if;

    return query
    select resolved_incident_id, inserted_count = 1;
end;
$$;

alter function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, text, text, integer, smallint, timestamptz
) owner to postgres;

revoke all on function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, text, text, integer, smallint, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, text, text, integer, smallint, timestamptz
) to service_role;

-- IF NOT EXISTS is intentional: the PWA migration lineage may already have
-- created this content-free receipt table before the Android/Supabase source
-- trees are consolidated. Its compatible V3 receipt shape is preserved.
create table if not exists public.v2_ephemeral_incident_receipts (
    incident_id uuid primary key
        references public.v2_safety_incidents(id) on delete cascade,
    submission_hash bytea not null
        check (octet_length(submission_hash) = 32),
    privacy_identity_version bigint not null
        check (privacy_identity_version > 0),
    key_version integer not null check (key_version > 0),
    message_count smallint not null check (message_count between 1 and 60),
    context_expires_at timestamptz not null,
    state text not null default 'received'
        check (state in ('received', 'leased', 'completed')),
    lease_token_hash bytea,
    lease_expires_at timestamptz,
    completion_request_hash bytea,
    completion_lease_token_hash bytea,
    completion_incident_status text,
    completion_analysis_outcome text,
    completion_delivery_count integer,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        context_expires_at > created_at
        and context_expires_at <= created_at + interval '7 days'
    ),
    check (
        (state = 'leased' and lease_token_hash is not null and lease_expires_at is not null)
        or (state <> 'leased' and lease_token_hash is null and lease_expires_at is null)
    ),
    check (
        state <> 'completed'
        or (
            completion_request_hash is not null
            and completion_lease_token_hash is not null
            and completion_incident_status in ('confirmed', 'dismissed', 'alerted')
            and completion_analysis_outcome in ('confirmed', 'dismissed')
            and completion_delivery_count >= 0
            and completed_at is not null
        )
    )
);

comment on table public.v2_ephemeral_incident_receipts is
    'Content-free V3 idempotency and lease receipts. Stores hashes and routing metadata only; never plaintext, ciphertext, excerpts, embeddings, prompts or display identities.';

alter table public.v2_ephemeral_incident_receipts enable row level security;

alter table public.v2_ephemeral_incident_receipts force row level security;

drop trigger if exists v2_ephemeral_incident_receipts_set_updated_at
on public.v2_ephemeral_incident_receipts;

create trigger v2_ephemeral_incident_receipts_set_updated_at
before update on public.v2_ephemeral_incident_receipts
for each row execute function public.v2_set_updated_at();

create or replace function public.v2_begin_ephemeral_incident_analysis_service(
    target_device_id uuid,
    target_client_incident_id uuid,
    target_category text,
    target_severity text,
    target_child_role text,
    target_confidence real,
    target_capture_quality real,
    target_occurred_at timestamptz,
    target_model_contract_version smallint,
    target_privacy_contract_version smallint,
    target_privacy_identity_version bigint,
    target_key_version integer,
    target_message_count smallint,
    target_context_expires_at timestamptz,
    target_submission_hash_hex text,
    target_lease_seconds integer default 120
)
returns table (
    incident_id uuid,
    created boolean,
    analysis_state text,
    lease_token text,
    incident_status text,
    analysis_outcome text,
    delivery_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    resolved_child_id uuid;
    resolved_incident_id uuid;
    resolved_created boolean := false;
    resolved_hash bytea;
    receipt_row public.v2_ephemeral_incident_receipts%rowtype;
    incident_row public.v2_safety_incidents%rowtype;
    resolved_lease_token text;
begin
    select device.child_id
      into resolved_child_id
      from public.v2_protected_devices device
     where device.id = target_device_id
       and device.status in ('active', 'degraded');

    if resolved_child_id is null then
        raise exception 'device_not_active' using errcode = '42501';
    end if;

    if target_model_contract_version <> 2
       or target_privacy_contract_version <> 3
       or target_privacy_identity_version is null
       or target_privacy_identity_version < 1
       or target_key_version is null
       or target_key_version < 1
       or target_message_count is null
       or target_message_count not between 1 and 60
       or target_context_expires_at is null
       or target_context_expires_at <= now()
       or target_context_expires_at > now() + interval '7 days'
       or target_lease_seconds is null
       or target_lease_seconds not between 30 and 180
       or target_submission_hash_hex is null
       or target_submission_hash_hex !~ '^[0-9a-f]{64}$' then
        raise exception 'invalid_ephemeral_incident_header'
            using errcode = '22023';
    end if;

    resolved_hash := decode(target_submission_hash_hex, 'hex');

    insert into public.v2_safety_incidents (
        device_id,
        child_id,
        client_incident_id,
        category,
        severity,
        child_role,
        confidence,
        capture_quality,
        occurred_at,
        model_contract_version,
        privacy_contract_version
    ) values (
        target_device_id,
        resolved_child_id,
        target_client_incident_id,
        target_category,
        target_severity,
        target_child_role,
        target_confidence,
        target_capture_quality,
        target_occurred_at,
        target_model_contract_version,
        target_privacy_contract_version
    )
    on conflict (device_id, client_incident_id) do nothing
    returning id into resolved_incident_id;

    if resolved_incident_id is not null then
        resolved_created := true;
        insert into public.v2_ephemeral_incident_receipts (
            incident_id,
            submission_hash,
            privacy_identity_version,
            key_version,
            message_count,
            context_expires_at
        ) values (
            resolved_incident_id,
            resolved_hash,
            target_privacy_identity_version,
            target_key_version,
            target_message_count,
            target_context_expires_at
        );

        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            object_id,
            outcome,
            metadata
        ) values (
            'device',
            'v2.incident.submit.ephemeral',
            'safety_incident',
            resolved_incident_id,
            'success',
            jsonb_build_object('privacy_contract_version', 3)
        );
    else
        select incident.*
          into incident_row
          from public.v2_safety_incidents incident
         where incident.device_id = target_device_id
           and incident.client_incident_id = target_client_incident_id;

        if incident_row.id is null
           or incident_row.child_id <> resolved_child_id
           or incident_row.category <> target_category
           or incident_row.severity <> target_severity
           or incident_row.child_role <> target_child_role
           or incident_row.confidence <> target_confidence
           or incident_row.capture_quality <> target_capture_quality
           or incident_row.occurred_at <> target_occurred_at
           or incident_row.model_contract_version <> target_model_contract_version
           or incident_row.privacy_contract_version <> 3 then
            raise exception 'incident_idempotency_conflict'
                using errcode = '23505';
        end if;
        resolved_incident_id := incident_row.id;
    end if;

    select receipt.*
      into receipt_row
      from public.v2_ephemeral_incident_receipts receipt
     where receipt.incident_id = resolved_incident_id
     for update;

    if receipt_row.incident_id is null
       or receipt_row.submission_hash is distinct from resolved_hash
       or receipt_row.privacy_identity_version <> target_privacy_identity_version
       or receipt_row.key_version <> target_key_version
       or receipt_row.message_count <> target_message_count
       or receipt_row.context_expires_at <> target_context_expires_at then
        raise exception 'incident_idempotency_conflict'
            using errcode = '23505';
    end if;

    if receipt_row.state = 'completed' then
        return query select
            resolved_incident_id,
            resolved_created,
            'completed'::text,
            null::text,
            receipt_row.completion_incident_status,
            receipt_row.completion_analysis_outcome,
            receipt_row.completion_delivery_count;
        return;
    end if;

    if receipt_row.context_expires_at <= now() then
        raise exception 'ephemeral_incident_expired' using errcode = '57014';
    end if;

    if receipt_row.state = 'leased'
       and receipt_row.lease_expires_at > now() then
        return query select
            resolved_incident_id,
            resolved_created,
            'busy'::text,
            null::text,
            'analyzing'::text,
            null::text,
            0;
        return;
    end if;

    resolved_lease_token := encode(extensions.gen_random_bytes(32), 'hex');
    update public.v2_ephemeral_incident_receipts receipt
       set state = 'leased',
           lease_token_hash = extensions.digest(
               convert_to(resolved_lease_token, 'UTF8'),
               'sha256'
           ),
           lease_expires_at = least(
               now() + make_interval(secs => target_lease_seconds),
               receipt.context_expires_at
           )
     where receipt.incident_id = resolved_incident_id;

    update public.v2_safety_incidents incident
       set status = 'analyzing'
     where incident.id = resolved_incident_id
       and incident.status in ('received', 'analyzing', 'analysis_failed');

    return query select
        resolved_incident_id,
        resolved_created,
        'leased'::text,
        resolved_lease_token,
        'analyzing'::text,
        null::text,
        0;
end;
$$;

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
    if released_count = 1 then
        update public.v2_safety_incidents incident
           set status = 'received'
         where incident.id = target_incident_id
           and incident.status = 'analyzing'
           and not exists (
               select 1
               from public.v2_incident_analysis analysis
               where analysis.incident_id = target_incident_id
           );
    end if;
    return released_count = 1;
end;
$$;

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

alter function public.v2_begin_ephemeral_incident_analysis_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, integer, smallint, timestamptz, text, integer
) owner to postgres;

alter function public.v2_release_ephemeral_incident_analysis_service(uuid, text)
owner to postgres;

alter function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) owner to postgres;

revoke all on table public.v2_ephemeral_incident_receipts
from public, anon, authenticated, service_role;

revoke all on function public.v2_guard_incident_context_privacy_version()
from public, anon, authenticated, service_role;

revoke all on function public.v2_begin_ephemeral_incident_analysis_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, integer, smallint, timestamptz, text, integer
) from public, anon, authenticated, service_role;

revoke all on function public.v2_release_ephemeral_incident_analysis_service(
    uuid, text
) from public, anon, authenticated, service_role;

revoke all on function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) from public, anon, authenticated, service_role;

grant execute on function public.v2_begin_ephemeral_incident_analysis_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, integer, smallint, timestamptz, text, integer
) to service_role;

grant execute on function public.v2_release_ephemeral_incident_analysis_service(
    uuid, text
) to service_role;

grant execute on function public.v2_finalize_ephemeral_incident_analysis_service(
    uuid, text, text, text, text, text, text, text[], text, text, text,
    text, real, text[], text[]
) to service_role;

commit;
