begin;

alter table public.v2_safety_incidents
    add column privacy_contract_version smallint
        not null default 1
        check (privacy_contract_version = 1);

alter table public.v2_incident_context
    add column privacy_identity_version bigint
        not null default 1
        check (privacy_identity_version > 0);

comment on column public.v2_safety_incidents.privacy_contract_version is
    'Fail-closed outbound redaction and pseudonymization contract version.';

comment on column public.v2_incident_context.privacy_identity_version is
    'Version of the verified child privacy profile used before encryption.';

drop function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    text, text, integer, smallint, timestamptz
);

create function public.v2_submit_safety_incident_service(
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

    if target_privacy_contract_version <> 1
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

    if octet_length(decoded_payload) not between 1 and 65536
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
    )
    values (
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
           and incident.client_incident_id =
                target_client_incident_id
           and incident.category = target_category
           and incident.severity = target_severity
           and incident.child_role = target_child_role
           and incident.confidence = target_confidence
           and incident.capture_quality =
                target_capture_quality
           and incident.occurred_at = target_occurred_at
           and incident.model_contract_version =
                target_model_contract_version
           and incident.privacy_contract_version =
                target_privacy_contract_version
           and context.encrypted_payload = decoded_payload
           and context.encryption_algorithm =
                target_encryption_algorithm
           and context.key_version = target_key_version
           and context.message_count = target_message_count
           and context.privacy_identity_version =
                target_privacy_identity_version
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
        )
        values (
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
        )
        values (
            'device',
            'v2.incident.submit',
            'safety_incident',
            resolved_incident_id,
            'success',
            jsonb_build_object(
                'privacy_contract_version',
                target_privacy_contract_version,
                'privacy_identity_version',
                target_privacy_identity_version
            )
        );
    end if;

    return query
    select resolved_incident_id, inserted_count = 1;
end;
$$;

revoke all on function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, text, text, integer, smallint, timestamptz
) from public, anon, authenticated;

grant execute on function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    smallint, bigint, text, text, integer, smallint, timestamptz
) to service_role;

commit;
