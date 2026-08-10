begin;

create or replace function public.v2_register_device_service(
    actor_user_id uuid,
    target_child_id uuid,
    target_installation_id uuid,
    target_app_version text,
    target_capture_contract_version smallint,
    target_manufacturer text,
    target_model text,
    new_credential_hash text,
    credential_expires_at timestamptz
)
returns table (
    device_id uuid,
    credential_key_version integer,
    credential_expiry timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_family_id uuid;
    existing_device public.v2_protected_devices%rowtype;
    resolved_device_id uuid;
    next_key_version integer;
begin
    if actor_user_id is null
       or target_child_id is null
       or target_installation_id is null
       or char_length(target_app_version) not between 1 and 80
       or target_capture_contract_version < 2
       or char_length(new_credential_hash) <> 64
       or credential_expires_at <= now()
       or credential_expires_at > now() + interval '180 days' then
        raise exception 'invalid_registration_request'
            using errcode = '22023';
    end if;

    select child.family_id
      into target_family_id
      from public.v2_children child
     where child.id = target_child_id
       and child.status = 'active';

    if target_family_id is null or not exists (
        select 1
          from public.v2_guardian_memberships membership
         where membership.family_id = target_family_id
           and membership.guardian_user_id = actor_user_id
           and membership.status = 'active'
    ) then
        raise exception 'guardian_not_authorized'
            using errcode = '42501';
    end if;

    select *
      into existing_device
      from public.v2_protected_devices device
     where device.installation_id = target_installation_id
     for update;

    if existing_device.id is not null
       and existing_device.child_id <> target_child_id then
        raise exception 'installation_already_assigned'
            using errcode = '23505';
    end if;

    if existing_device.id is null then
        insert into public.v2_protected_devices (
            child_id,
            installation_id,
            app_version,
            capture_contract_version,
            manufacturer,
            model,
            status,
            last_seen_at
        )
        values (
            target_child_id,
            target_installation_id,
            target_app_version,
            target_capture_contract_version,
            left(target_manufacturer, 120),
            left(target_model, 120),
            'active',
            now()
        )
        returning id into resolved_device_id;
    else
        update public.v2_protected_devices
           set app_version = target_app_version,
               capture_contract_version = target_capture_contract_version,
               manufacturer = left(target_manufacturer, 120),
               model = left(target_model, 120),
               status = 'active',
               last_seen_at = now()
         where id = existing_device.id
        returning id into resolved_device_id;
    end if;

    update public.v2_device_credentials
       set revoked_at = coalesce(revoked_at, now())
     where v2_device_credentials.device_id = resolved_device_id
       and revoked_at is null;

    select coalesce(max(key_version), 0) + 1
      into next_key_version
      from public.v2_device_credentials
     where v2_device_credentials.device_id = resolved_device_id;

    insert into public.v2_device_credentials (
        device_id,
        credential_hash,
        key_version,
        expires_at
    )
    values (
        resolved_device_id,
        new_credential_hash,
        next_key_version,
        credential_expires_at
    );

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome
    )
    values (
        actor_user_id,
        'guardian',
        'v2.device.register',
        'protected_device',
        resolved_device_id,
        'success'
    );

    return query
    select resolved_device_id, next_key_version, credential_expires_at;
end;
$$;

create or replace function public.v2_report_device_health_service(
    target_device_id uuid,
    target_event_key uuid,
    target_capture_ready boolean,
    target_accessibility_enabled boolean,
    target_notification_listener_enabled boolean,
    target_battery_optimization_exempt boolean,
    target_oem_autostart_state text,
    target_degraded_reasons text[],
    target_observed_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    inserted_count integer;
begin
    if coalesce(array_length(target_degraded_reasons, 1), 0) > 12
       or exists (
           select 1
             from unnest(target_degraded_reasons) reason
            where char_length(reason) > 80
       ) then
        raise exception 'invalid_degraded_reasons'
            using errcode = '22023';
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
        observed_at
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
        target_observed_at
    )
    on conflict (device_id, event_key) do nothing;

    get diagnostics inserted_count = row_count;

    update public.v2_protected_devices
       set last_seen_at = now(),
           status = case
               when target_capture_ready then 'active'
               else 'degraded'
           end
     where id = target_device_id
       and status <> 'revoked';

    if inserted_count = 1 then
        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            object_id,
            outcome
        )
        values (
            'device',
            'v2.device.health.report',
            'protected_device',
            target_device_id,
            'success'
        );
    end if;

    return inserted_count = 1;
end;
$$;

create or replace function public.v2_claim_device_commands_service(
    target_device_id uuid,
    requested_limit smallint default 10
)
returns table (
    id uuid,
    command_type text,
    payload jsonb,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
    if requested_limit not between 1 and 20 then
        raise exception 'invalid_command_limit'
            using errcode = '22023';
    end if;

    update public.v2_device_commands command
       set status = 'expired'
     where command.device_id = target_device_id
       and command.status = 'pending'
       and command.expires_at <= now();

    return query
    with claimable as (
        select command.id
          from public.v2_device_commands command
         where command.device_id = target_device_id
           and command.status = 'pending'
           and command.not_before <= now()
           and command.expires_at > now()
         order by command.created_at
         limit requested_limit
         for update skip locked
    )
    update public.v2_device_commands command
       set status = 'claimed',
           claimed_at = now()
      from claimable
     where command.id = claimable.id
    returning
        command.id,
        command.command_type,
        command.payload,
        command.expires_at;
end;
$$;

create or replace function public.v2_finish_device_command_service(
    target_device_id uuid,
    target_command_id uuid,
    target_status text,
    target_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    updated_count integer;
begin
    if target_status not in ('completed', 'failed') then
        raise exception 'invalid_command_status'
            using errcode = '22023';
    end if;

    update public.v2_device_commands command
       set status = target_status,
           completed_at = now(),
           failure_code = case
               when target_status = 'failed'
               then left(target_failure_code, 80)
               else null
           end
     where command.id = target_command_id
       and command.device_id = target_device_id
       and command.status = 'claimed';

    get diagnostics updated_count = row_count;
    return updated_count = 1;
end;
$$;

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

    begin
        decoded_payload := decode(target_encrypted_payload_base64, 'base64');
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
        model_contract_version
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
        target_model_contract_version
    )
    on conflict (device_id, client_incident_id) do nothing
    returning id into resolved_incident_id;

    get diagnostics inserted_count = row_count;

    if inserted_count = 0 then
        select incident.id
          into resolved_incident_id
          from public.v2_safety_incidents incident
         where incident.device_id = target_device_id
           and incident.client_incident_id = target_client_incident_id;
    else
        insert into public.v2_incident_context (
            incident_id,
            encrypted_payload,
            encryption_algorithm,
            key_version,
            message_count,
            expires_at
        )
        values (
            resolved_incident_id,
            decoded_payload,
            target_encryption_algorithm,
            target_key_version,
            target_message_count,
            target_context_expires_at
        );

        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            object_id,
            outcome
        )
        values (
            'device',
            'v2.incident.submit',
            'safety_incident',
            resolved_incident_id,
            'success'
        );
    end if;

    return query
    select resolved_incident_id, inserted_count = 1;
end;
$$;

revoke all on function public.v2_register_device_service(
    uuid, uuid, uuid, text, smallint, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.v2_report_device_health_service(
    uuid, uuid, boolean, boolean, boolean, boolean, text, text[], timestamptz
) from public, anon, authenticated;
revoke all on function public.v2_claim_device_commands_service(
    uuid, smallint
) from public, anon, authenticated;
revoke all on function public.v2_finish_device_command_service(
    uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    text, text, integer, smallint, timestamptz
) from public, anon, authenticated;

grant execute on function public.v2_register_device_service(
    uuid, uuid, uuid, text, smallint, text, text, text, timestamptz
) to service_role;
grant execute on function public.v2_report_device_health_service(
    uuid, uuid, boolean, boolean, boolean, boolean, text, text[], timestamptz
) to service_role;
grant execute on function public.v2_claim_device_commands_service(
    uuid, smallint
) to service_role;
grant execute on function public.v2_finish_device_command_service(
    uuid, uuid, text, text
) to service_role;
grant execute on function public.v2_submit_safety_incident_service(
    uuid, uuid, text, text, text, real, real, timestamptz, smallint,
    text, text, integer, smallint, timestamptz
) to service_role;

commit;
