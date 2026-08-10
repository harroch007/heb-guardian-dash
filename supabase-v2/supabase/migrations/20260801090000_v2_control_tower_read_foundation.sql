begin;

-- CT-R0-v1 is a read-only staff surface. It may persist access audit evidence
-- and normalized encrypted inbound WhatsApp envelopes, but exposes no product
-- mutation, outbound message, device command, action transition, or dispatcher.

create or replace function public.v2_admin_json_is_safe(
    target_value jsonb,
    target_max_bytes integer default 131072
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    item_key text;
    item_value jsonb;
begin
    if target_value is null
       or target_max_bytes < 1
       or octet_length(target_value::text) > target_max_bytes then
        return false;
    end if;

    if jsonb_typeof(target_value) = 'object' then
        for item_key, item_value in
            select entry.key, entry.value
              from jsonb_each(target_value) as entry
        loop
            if lower(item_key) = any (array[
                'wa_id', 'phone', 'phone_number', 'email', 'text', 'body',
                'password', 'otp', 'secret', 'token', 'access_token',
                'refresh_token', 'activation_token', 'credential',
                'credential_hash', 'auth_secret', 'p256dh', 'raw',
                'raw_text', 'raw_message', 'raw_payload',
                'encrypted_payload'
            ]) then
                return false;
            end if;
            if jsonb_typeof(item_value) in ('object', 'array')
               and not public.v2_admin_json_is_safe(
                   item_value,
                   target_max_bytes
               ) then
                return false;
            end if;
        end loop;
    elsif jsonb_typeof(target_value) = 'array' then
        for item_value in
            select value from jsonb_array_elements(target_value)
        loop
            if jsonb_typeof(item_value) in ('object', 'array')
               and not public.v2_admin_json_is_safe(
                   item_value,
                   target_max_bytes
               ) then
                return false;
            end if;
        end loop;
    end if;

    return true;
end;
$$;

create or replace function public.v2_admin_get_parent_safe_incident(
    target_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    admin_case record;
    result_data jsonb;
    audit_id bigint;
begin
    if not public.v2_admin_can_read_case(
        target_case_id, 'safety.parent_safe.read'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'parent_safe_incident', target_case_id,
            'safety_review', 'permission_denied',
            array['parent_safe_incident']
        );
    end if;

    select * into admin_case
      from public.v2_admin_cases admin_case_row
     where admin_case_row.id = target_case_id;

    if admin_case.source_mode = 'fixture' then
        select snapshot.service360_document->'parental_controls'
          into result_data
          from public.v2_admin_fixture_snapshots snapshot
         where snapshot.fixture_key = admin_case.fixture_key;
    elsif admin_case.incident_id is null then
        result_data := public.v2_admin_field_envelope(
            null, 'v2_admin_cases.incident_id', null, null,
            admin_case.updated_at, 'unknown', 'restricted',
            'not_available', admin_case.updated_at::text,
            'REQUIRES_PROJECTION'
        );
    else
        select public.v2_admin_field_envelope(
            case
                when incident.status not in ('confirmed', 'alerted')
                     or analysis.outcome is distinct from 'confirmed'
                    then null
                else jsonb_build_object(
                    'incident_id', incident.id,
                    'category', incident.category,
                    'severity', incident.severity,
                    'child_role', incident.child_role,
                    'confidence', incident.confidence,
                    'capture_quality', incident.capture_quality,
                    'status', incident.status,
                    'source_platform', incident.source_platform,
                    'privacy_contract_version',
                        incident.privacy_contract_version,
                    'reason_code', analysis.reason_code,
                    'action_code', analysis.action_code,
                    'safe_summary', analysis.safe_summary,
                    'safe_reason', analysis.safe_reason,
                    'recommended_action', analysis.recommended_action,
                    'occurred_at', incident.occurred_at,
                    'received_at', incident.received_at,
                    'analyzed_at', analysis.analyzed_at,
                    'delivery', jsonb_build_object(
                        'attempt_count', (
                            select count(*)
                              from public.v2_alert_deliveries delivery
                             where delivery.incident_id = incident.id
                        ),
                        'delivered_count', (
                            select count(*)
                              from public.v2_alert_deliveries delivery
                             where delivery.incident_id = incident.id
                               and delivery.status = 'delivered'
                        ),
                        'channels', coalesce((
                            select jsonb_agg(distinct delivery.channel)
                              from public.v2_alert_deliveries delivery
                             where delivery.incident_id = incident.id
                        ), '[]'::jsonb),
                        'last_attempted_at', (
                            select max(delivery.attempted_at)
                              from public.v2_alert_deliveries delivery
                             where delivery.incident_id = incident.id
                        ),
                        'last_delivered_at', (
                            select max(delivery.delivered_at)
                              from public.v2_alert_deliveries delivery
                             where delivery.incident_id = incident.id
                        )
                    )
                )
            end,
            'v2_safety_incidents+v2_incident_analysis',
            incident.occurred_at,
            incident.received_at,
            analysis.analyzed_at,
            case
                when incident.status in ('confirmed', 'alerted')
                     and analysis.outcome = 'confirmed' then 'fresh'
                else 'unknown'
            end,
            'restricted',
            'parent_safe_only',
            concat_ws(
                ':', incident.model_contract_version::text,
                incident.privacy_contract_version::text,
                extract(epoch from analysis.analyzed_at)::bigint::text
            ),
            case
                when incident.status in ('confirmed', 'alerted')
                     and analysis.outcome = 'confirmed' then 'EXISTING_V2'
                else 'REQUIRES_PROJECTION'
            end
        )
          into result_data
          from public.v2_safety_incidents incident
          left join public.v2_incident_analysis analysis
            on analysis.incident_id = incident.id
         where incident.id = admin_case.incident_id;

        if result_data is null then
            result_data := public.v2_admin_field_envelope(
                null, 'v2_safety_incidents', null, null,
                admin_case.updated_at, 'unknown', 'restricted',
                'not_available', admin_case.updated_at::text,
                'REQUIRES_PROJECTION'
            );
        end if;
    end if;

    audit_id := public.v2_admin_write_audit_event(
        'safety.parent_safe_read', 'success', target_case_id, null,
        'parent_safe_incident', admin_case.incident_id, 'safety_review',
        array['parent_safe_incident'], null, gen_random_uuid(),
        jsonb_build_object('source_mode', admin_case.source_mode)
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

create or replace function public.v2_admin_list_case_actions(
    target_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
    source_mode_value text;
    audit_id bigint;
begin
    if not public.v2_admin_can_read_case(
        target_case_id, 'case.read.assigned'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'case_actions', target_case_id,
            'action_lifecycle_review', 'permission_denied',
            array['action_lifecycle']
        );
    end if;

    select admin_case.source_mode into source_mode_value
      from public.v2_admin_cases admin_case
     where admin_case.id = target_case_id;

    select coalesce(
        jsonb_agg(item.payload order by item.created_at desc, item.id desc),
        '[]'::jsonb
    )
      into result_data
      from (
          select action.id,
                 action.created_at,
                 jsonb_build_object(
                     'action_id', action.id,
                     'action_key', action.action_key,
                     'risk_class', action.risk_class,
                     'status', action.status,
                     'resource_type', action.resource_type,
                     'resource_id', action.resource_id,
                     'purpose_code', action.purpose_code,
                     'policy_version', action.policy_version,
                     'expected_revision', action.expected_revision,
                     'expires_at', action.expires_at,
                     'created_at', action.created_at,
                     'updated_at', action.updated_at,
                     'approvals', coalesce((
                         select jsonb_agg(jsonb_build_object(
                             'approval_id', approval.id,
                             'approval_kind', approval.approval_kind,
                             'decision', approval.decision,
                             'assurance_level', approval.assurance_level,
                             'decided_at', approval.decided_at,
                             'expires_at', approval.expires_at
                         ) order by approval.decided_at, approval.id)
                           from public.v2_admin_approvals approval
                          where approval.action_request_id = action.id
                     ), '[]'::jsonb),
                     'effects', coalesce((
                         select jsonb_agg(jsonb_build_object(
                             'outbox_id', effect.id,
                             'effect_key', effect.effect_key,
                             'destination_kind', effect.destination_kind,
                             'status', effect.status,
                             'attempt_count', effect.attempt_count,
                             'not_before', effect.not_before,
                             'dispatched_at', effect.dispatched_at,
                             'acknowledged_at', effect.acknowledged_at,
                             'last_failure_code', effect.last_failure_code
                         ) order by effect.created_at, effect.id)
                           from public.v2_admin_outbox effect
                          where effect.action_request_id = action.id
                     ), '[]'::jsonb)
                 ) payload
            from public.v2_admin_action_requests action
           where action.case_id = target_case_id
           order by action.created_at desc, action.id desc
           limit 100
      ) item;

    audit_id := public.v2_admin_write_audit_event(
        'action_lifecycle.read', 'success', target_case_id, null,
        'case_actions', target_case_id, 'action_lifecycle_review',
        array['action_lifecycle'], null, gen_random_uuid(),
        jsonb_build_object('result_count', jsonb_array_length(result_data))
    );
    return jsonb_build_object(
        'schema_version', 1,
        'generated_at', now(),
        'source_mode', source_mode_value,
        'data', result_data,
        'page', jsonb_build_object('limit', 100),
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_list_audit_events(
    target_case_id uuid default null,
    target_before_created_at timestamptz default null,
    target_before_event_id bigint default null,
    target_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    staff_principal_id uuid;
    staff_environment text;
    result_data jsonb;
    audit_id bigint;
begin
    if target_limit not between 1 and 100
       or ((target_before_created_at is null)
           <> (target_before_event_id is null)) then
        raise exception 'invalid_audit_query' using errcode = '22023';
    end if;

    if not public.v2_admin_has_permission('audit.read', target_case_id)
       or (
           target_case_id is not null
           and not public.v2_admin_can_read_case(
               target_case_id, 'audit.read'
           )
       ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'audit_events', target_case_id,
            'audit_review', 'permission_denied', array['audit_event']
        );
    end if;

    staff_principal_id := public.v2_admin_current_staff_principal();
    select principal.environment into staff_environment
      from public.v2_admin_principals principal
     where principal.id = staff_principal_id;

    select coalesce(
        jsonb_agg(item.payload order by item.created_at desc, item.id desc),
        '[]'::jsonb
    )
      into result_data
      from (
          select event.id,
                 event.created_at,
                 jsonb_build_object(
                     'audit_event_id', event.id,
                     'event_id', event.event_id,
                     'event_type', event.event_type,
                     'outcome', event.outcome,
                     'actor_principal_id', event.actor_principal_id,
                     'sponsor_principal_id', event.sponsor_principal_id,
                     'case_id', event.case_id,
                     'conversation_id', event.conversation_id,
                     'action_request_id', event.action_request_id,
                     'approval_id', event.approval_id,
                     'purpose_code', event.purpose_code,
                     'permission_snapshot', event.permission_snapshot,
                     'policy_version', event.policy_version,
                     'policy_decision', event.policy_decision,
                     'deny_reason_code', event.deny_reason_code,
                     'object_type', event.object_type,
                     'object_id', event.object_id,
                     'requested_action', event.requested_action,
                     'executed_action', event.executed_action,
                     'field_keys', event.field_keys,
                     'sensitivity', event.sensitivity,
                     'correlation_id', event.correlation_id,
                     'version_snapshot', event.version_snapshot,
                     'safe_metadata', event.safe_metadata,
                     'created_at', event.created_at
                 ) payload
            from public.v2_admin_audit_events event
           where event.environment = staff_environment
             and (
                 target_case_id is null
                 or event.case_id = target_case_id
             )
             and (
                 target_before_created_at is null
                 or (event.created_at, event.id) <
                    (target_before_created_at, target_before_event_id)
             )
           order by event.created_at desc, event.id desc
           limit target_limit
      ) item;

    audit_id := public.v2_admin_write_audit_event(
        'audit.read', 'success', target_case_id, null,
        'audit_events', target_case_id, 'audit_review',
        array['audit_event'], null, gen_random_uuid(),
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

create or replace function public.v2_admin_valid_ciphertext_envelope(
    target_value jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select coalesce((
        target_value is not null
        and jsonb_typeof(target_value) = 'object'
        and not exists (
            select 1
              from jsonb_object_keys(target_value) as item_key
             where item_key not in (
                 'algorithm', 'aad_manifest_version', 'nonce_base64',
                 'aad_sha256', 'ciphertext_base64'
             )
        )
        and target_value->>'algorithm' = 'AES-256-GCM'
        and target_value->'aad_manifest_version' = '2'::jsonb
        and target_value->>'nonce_base64' ~ '^[A-Za-z0-9+/]+={0,2}$'
        and char_length(target_value->>'nonce_base64') between 16 and 128
        and target_value->>'aad_sha256' ~ '^[0-9a-f]{64}$'
        and target_value->>'ciphertext_base64' ~ '^[A-Za-z0-9+/]+={0,2}$'
        and char_length(target_value->>'ciphertext_base64')
            between 24 and 87404
        and public.v2_admin_json_is_safe(target_value, 90000)
    ), false);
$$;

create table public.v2_admin_principals (
    id uuid primary key default gen_random_uuid(),
    principal_type text not null check (
        principal_type in ('staff', 'agent', 'service')
    ),
    principal_key text not null check (
        principal_key ~ '^[a-z0-9_.:-]{3,120}$'
    ),
    display_name text not null check (
        char_length(display_name) between 1 and 120
    ),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    status text not null check (
        status in ('invited', 'shadow', 'active', 'suspended', 'revoked')
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (environment, principal_key)
);

create table public.v2_staff_profiles (
    principal_id uuid primary key
        references public.v2_admin_principals(id) on delete restrict,
    auth_user_id uuid not null unique
        references auth.users(id) on delete restrict,
    locale text not null default 'he'
        check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_agent_identities (
    principal_id uuid primary key
        references public.v2_admin_principals(id) on delete restrict,
    agent_kind text not null check (agent_kind in (
        'front_office', 'domain_specialist', 'internal_copilot',
        'workflow_service', 'policy_service', 'audit_writer'
    )),
    domain_key text not null check (
        domain_key ~ '^[a-z0-9_.:-]{2,80}$'
    ),
    agent_version text not null check (
        char_length(agent_version) between 1 and 80
    ),
    tool_allowlist text[] not null default '{}',
    sponsor_required boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_staff_roles (
    role_key text primary key check (role_key ~ '^[a-z0-9_.:-]{2,80}$'),
    display_name text not null check (
        char_length(display_name) between 1 and 120
    ),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table public.v2_staff_permissions (
    permission_key text primary key
        check (permission_key ~ '^[a-z0-9_.:-]{3,120}$'),
    risk_class text not null check (risk_class in (
        'r0_masked', 'r0_sensitive', 'r1_internal',
        'r1_communication', 'r2', 'r3'
    )),
    description text not null check (
        char_length(description) between 1 and 240
    ),
    created_at timestamptz not null default now()
);

create table public.v2_staff_role_permissions (
    role_key text not null
        references public.v2_staff_roles(role_key) on delete restrict,
    permission_key text not null
        references public.v2_staff_permissions(permission_key)
        on delete restrict,
    created_at timestamptz not null default now(),
    primary key (role_key, permission_key)
);

create table public.v2_staff_role_assignments (
    id uuid primary key default gen_random_uuid(),
    staff_principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    role_key text not null
        references public.v2_staff_roles(role_key) on delete restrict,
    environment text not null check (
        environment in ('staging', 'production')
    ),
    scope_type text not null default 'global'
        check (scope_type in ('global', 'queue', 'case')),
    scope_key text,
    valid_from timestamptz not null default now(),
    expires_at timestamptz,
    granted_by_principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    reason_code text not null check (
        char_length(reason_code) between 2 and 120
    ),
    created_at timestamptz not null default now(),
    check (
        (scope_type = 'global' and scope_key is null)
        or (scope_type <> 'global' and scope_key is not null)
    ),
    check (expires_at is null or expires_at > valid_from)
);

create unique index v2_staff_role_assignment_identity
    on public.v2_staff_role_assignments(
        staff_principal_id,
        role_key,
        environment,
        scope_type,
        coalesce(scope_key, '')
    );

create table public.v2_admin_fixture_snapshots (
    fixture_key text primary key
        check (fixture_key ~ '^[a-z0-9_.:-]{3,100}$'),
    schema_version integer not null default 1 check (schema_version = 1),
    title text not null check (char_length(title) between 1 and 160),
    service360_document jsonb not null,
    is_synthetic boolean not null default true check (is_synthetic),
    created_at timestamptz not null default now(),
    check (
        public.v2_admin_json_is_safe(service360_document, 131072)
    )
);

create table public.v2_support_contacts (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    contact_kind text not null check (
        contact_kind in ('parent', 'prospect', 'partner', 'unknown')
    ),
    contact_hash text not null check (contact_hash ~ '^[0-9a-f]{64}$'),
    display_label_redacted text not null check (
        char_length(display_label_redacted) between 1 and 120
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (environment, contact_hash)
);

create table public.v2_support_channel_identities (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    contact_id uuid not null
        references public.v2_support_contacts(id) on delete restrict,
    channel text not null check (
        channel in ('fixture', 'whatsapp', 'web', 'email', 'phone')
    ),
    provider_account_key text not null check (
        provider_account_key ~ '^[0-9a-f]{64}$'
    ),
    provider_identity_hash text not null check (
        provider_identity_hash ~ '^[0-9a-f]{64}$'
    ),
    display_identity_redacted text not null check (
        char_length(display_identity_redacted) between 1 and 120
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (
        environment,
        channel,
        provider_account_key,
        provider_identity_hash
    )
);

create table public.v2_support_conversations (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    source_mode text not null check (source_mode in ('fixture', 'staging')),
    channel_identity_id uuid not null
        references public.v2_support_channel_identities(id)
        on delete restrict,
    channel text not null check (
        channel in ('fixture', 'whatsapp', 'web', 'email', 'phone')
    ),
    status text not null default 'open' check (status in (
        'open', 'ai_active', 'takeover_requested', 'human_active',
        'waiting_for_customer', 'waiting_for_human', 'resolved', 'closed'
    )),
    verification_level text not null default 'v0_unknown' check (
        verification_level in (
            'v0_unknown', 'v1_channel_possession',
            'v2_guardian', 'v3_action_bound'
        )
    ),
    verified_guardian_user_id uuid
        references auth.users(id) on delete set null,
    verified_family_id uuid
        references public.v2_families(id) on delete set null,
    verification_evidence_ref uuid,
    verification_expires_at timestamptz,
    responder_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    responder_lease_id uuid,
    responder_lease_expires_at timestamptz,
    last_activity_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    closed_at timestamptz,
    check (
        source_mode = 'fixture'
        or verification_level not in ('v2_guardian', 'v3_action_bound')
        or (
            verified_guardian_user_id is not null
            and verified_family_id is not null
            and verification_evidence_ref is not null
            and verification_expires_at is not null
        )
    )
);

create unique index v2_one_open_whatsapp_conversation
    on public.v2_support_conversations(environment, channel_identity_id)
    where channel = 'whatsapp'
      and status not in ('resolved', 'closed');

create table public.v2_support_messages (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    conversation_id uuid not null
        references public.v2_support_conversations(id) on delete restrict,
    provider_account_hmac text
        check (provider_account_hmac is null or provider_account_hmac ~ '^[0-9a-f]{64}$'),
    provider_phone_scope_hmac text
        check (provider_phone_scope_hmac is null or provider_phone_scope_hmac ~ '^[0-9a-f]{64}$'),
    provider_message_hmac text
        check (provider_message_hmac is null or provider_message_hmac ~ '^[0-9a-f]{64}$'),
    direction text not null check (
        direction in ('inbound', 'outbound', 'internal')
    ),
    message_type text not null check (message_type in (
        'text', 'image', 'video', 'audio', 'voice', 'document',
        'location', 'contact', 'interactive', 'reaction', 'sticker',
        'button', 'contacts', 'order', 'system', 'unsupported',
        'internal_note'
    )),
    ingest_status text not null check (
        ingest_status in ('received', 'validated', 'persisted', 'duplicate', 'rejected')
    ),
    delivery_status text not null default 'not_applicable' check (
        delivery_status in (
            'not_applicable', 'queued', 'provider_accepted',
            'delivered', 'read', 'failed'
        )
    ),
    redacted_text text check (
        redacted_text is null or char_length(redacted_text) <= 4000
    ),
    protected_content_ref text check (
        protected_content_ref is null
        or protected_content_ref ~ '^[A-Za-z0-9_.:-]{1,160}$'
    ),
    provider_media_hmac text check (
        provider_media_hmac is null
        or provider_media_hmac ~ '^[0-9a-f]{64}$'
    ),
    media_mime_type text check (
        media_mime_type is null
        or char_length(media_mime_type) between 1 and 255
    ),
    media_provider_sha256 text check (
        media_provider_sha256 is null
        or media_provider_sha256 ~ '^[A-Za-z0-9+/=_-]{1,128}$'
    ),
    media_scan_state text check (
        media_scan_state is null or media_scan_state = 'quarantined'
    ),
    reply_to_message_id uuid
        references public.v2_support_messages(id) on delete set null,
    provider_occurred_at timestamptz,
    server_received_at timestamptz not null default now(),
    retention_class text not null default 'support_standard'
        check (retention_class ~ '^[a-z0-9_.:-]{2,80}$'),
    sensitivity text not null default 'confidential'
        check (sensitivity in ('public', 'internal', 'confidential', 'restricted')),
    failure_code text check (
        failure_code is null or char_length(failure_code) <= 120
    ),
    created_at timestamptz not null default now(),
    check (
        direction <> 'inbound'
        or redacted_text is null
        or message_type = 'internal_note'
    )
);

create unique index v2_support_provider_message_identity
    on public.v2_support_messages(
        environment,
        provider_account_hmac,
        provider_phone_scope_hmac,
        provider_message_hmac
    )
    where provider_account_hmac is not null
      and provider_phone_scope_hmac is not null
      and provider_message_hmac is not null;

create table public.v2_admin_cases (
    id uuid primary key default gen_random_uuid(),
    case_number bigint generated always as identity unique,
    environment text not null check (
        environment in ('staging', 'production')
    ),
    source_mode text not null check (source_mode in ('fixture', 'staging')),
    fixture_key text
        references public.v2_admin_fixture_snapshots(fixture_key)
        on delete restrict,
    domain_key text not null check (domain_key ~ '^[a-z0-9_.:-]{2,80}$'),
    category_key text not null check (category_key ~ '^[a-z0-9_.:-]{2,80}$'),
    intent_key text not null check (intent_key ~ '^[a-z0-9_.:-]{2,80}$'),
    priority text not null check (priority in ('s0', 's1', 's2', 's3')),
    status text not null default 'open' check (status in (
        'open', 'triaged', 'identity_pending', 'working',
        'waiting_for_customer', 'waiting_for_data', 'waiting_for_human',
        'waiting_for_external', 'resolution_proposed',
        'verifying_resolution', 'resolved', 'closed'
    )),
    substatus text,
    resume_status text,
    queue_key text not null check (queue_key ~ '^[a-z0-9_.:-]{2,80}$'),
    purpose_code text not null check (
        purpose_code ~ '^[a-z0-9_.:-]{2,100}$'
    ),
    sensitivity text not null check (
        sensitivity in ('public', 'internal', 'confidential', 'restricted')
    ),
    privacy_class text not null check (
        privacy_class ~ '^[a-z0-9_.:-]{2,80}$'
    ),
    verification_level text not null check (verification_level in (
        'v0_unknown', 'v1_channel_possession',
        'v2_guardian', 'v3_action_bound'
    )),
    family_id uuid references public.v2_families(id) on delete restrict,
    child_id uuid references public.v2_children(id) on delete restrict,
    device_id uuid references public.v2_protected_devices(id) on delete restrict,
    incident_id uuid references public.v2_safety_incidents(id) on delete restrict,
    accountable_owner_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    resolver_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    human_supervisor_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    sla_deadline_at timestamptz,
    wait_deadline_at timestamptz,
    wake_condition text,
    closure_reason text,
    root_cause_code text,
    resolution_code text,
    reopen_count integer not null default 0 check (reopen_count >= 0),
    last_activity_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    closed_at timestamptz,
    check (
        (source_mode = 'fixture' and fixture_key is not null
         and family_id is null and child_id is null
         and device_id is null and incident_id is null)
        or
        (source_mode = 'staging' and fixture_key is null)
    )
);

create table public.v2_admin_case_conversations (
    case_id uuid not null
        references public.v2_admin_cases(id) on delete cascade,
    conversation_id uuid not null
        references public.v2_support_conversations(id) on delete restrict,
    is_primary boolean not null default false,
    linked_at timestamptz not null default now(),
    primary key (case_id, conversation_id)
);

create unique index v2_one_primary_conversation_per_case
    on public.v2_admin_case_conversations(case_id)
    where is_primary;

create table public.v2_admin_case_participants (
    case_id uuid not null
        references public.v2_admin_cases(id) on delete cascade,
    principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    participant_role text not null check (
        participant_role in ('owner', 'resolver', 'supervisor', 'viewer')
    ),
    assigned_at timestamptz not null default now(),
    removed_at timestamptz,
    primary key (case_id, principal_id, participant_role, assigned_at),
    check (removed_at is null or removed_at >= assigned_at)
);

create table public.v2_admin_case_events (
    id bigint generated always as identity primary key,
    event_id uuid not null default gen_random_uuid() unique,
    case_id uuid not null
        references public.v2_admin_cases(id) on delete cascade,
    event_type text not null check (
        event_type ~ '^[a-z0-9_.:-]{2,100}$'
    ),
    previous_status text,
    new_status text,
    actor_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    reason_code text not null check (
        char_length(reason_code) between 2 and 120
    ),
    safe_metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    check (public.v2_admin_json_is_safe(safe_metadata, 32768))
);

create table public.v2_agent_delegations (
    id uuid primary key default gen_random_uuid(),
    agent_principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    sponsor_principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    case_id uuid not null
        references public.v2_admin_cases(id) on delete cascade,
    purpose_code text not null check (
        purpose_code ~ '^[a-z0-9_.:-]{2,100}$'
    ),
    permission_keys text[] not null default '{}',
    tool_keys text[] not null default '{}',
    status text not null check (status in ('active', 'revoked', 'expired')),
    valid_from timestamptz not null default now(),
    expires_at timestamptz not null,
    correlation_id uuid not null default gen_random_uuid(),
    created_at timestamptz not null default now(),
    check (expires_at > valid_from)
);

create table public.v2_admin_action_requests (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    case_id uuid not null
        references public.v2_admin_cases(id) on delete cascade,
    requested_by_principal_id uuid not null
        references public.v2_admin_principals(id) on delete restrict,
    sponsor_principal_id uuid
        references public.v2_admin_principals(id) on delete restrict,
    action_key text not null check (action_key ~ '^[a-z0-9_.:-]{2,120}$'),
    risk_class text not null check (risk_class in (
        'r0_masked', 'r0_sensitive', 'r1_internal',
        'r1_communication', 'r2', 'r3'
    )),
    status text not null check (status in (
        'draft', 'policy_checked', 'approval_pending', 'authorized',
        'queued', 'dispatched', 'acknowledged', 'verifying', 'verified',
        'denied', 'declined', 'expired', 'cancelled',
        'failed_retryable', 'failed_final'
    )),
    resource_type text not null check (
        resource_type ~ '^[a-z0-9_.:-]{2,80}$'
    ),
    resource_id uuid,
    purpose_code text not null check (
        purpose_code ~ '^[a-z0-9_.:-]{2,100}$'
    ),
    policy_version text not null check (
        char_length(policy_version) between 1 and 80
    ),
    request_schema_version integer not null default 1
        check (request_schema_version = 1),
    request_payload_sanitized jsonb not null default '{}'::jsonb,
    action_hash text not null check (action_hash ~ '^[0-9a-f]{64}$'),
    expected_revision text,
    idempotency_key text not null check (
        char_length(idempotency_key) between 8 and 200
    ),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (environment, idempotency_key),
    check (expires_at > created_at),
    check (
        public.v2_admin_json_is_safe(request_payload_sanitized, 16384)
    )
);

create table public.v2_admin_approvals (
    id uuid primary key default gen_random_uuid(),
    action_request_id uuid not null
        references public.v2_admin_action_requests(id) on delete cascade,
    approval_kind text not null check (
        approval_kind in ('guardian', 'staff_second_eye', 'step_up', 'policy')
    ),
    decision text not null check (decision in ('approved', 'declined')),
    approver_principal_id uuid
        references public.v2_admin_principals(id) on delete restrict,
    guardian_user_id uuid
        references auth.users(id) on delete restrict,
    action_hash text not null check (action_hash ~ '^[0-9a-f]{64}$'),
    assurance_level text,
    evidence_ref text not null check (
        evidence_ref ~ '^[A-Za-z0-9_.:-]{8,200}$'
    ),
    decided_at timestamptz not null default now(),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (
        (approver_principal_id is null) <>
        (guardian_user_id is null)
    ),
    check (expires_at > decided_at)
);

create table public.v2_admin_outbox (
    id uuid primary key default gen_random_uuid(),
    action_request_id uuid not null
        references public.v2_admin_action_requests(id) on delete cascade,
    effect_key text not null check (effect_key ~ '^[a-z0-9_.:-]{2,120}$'),
    destination_kind text not null check (
        destination_kind ~ '^[a-z0-9_.:-]{2,80}$'
    ),
    dispatch_envelope jsonb not null default '{}'::jsonb,
    status text not null check (status in (
        'pending', 'leased', 'dispatched', 'acknowledged',
        'failed_retryable', 'dead_letter', 'cancelled'
    )),
    idempotency_key text not null unique check (
        char_length(idempotency_key) between 8 and 200
    ),
    attempt_count integer not null default 0 check (attempt_count >= 0),
    not_before timestamptz not null default now(),
    leased_by text,
    lease_expires_at timestamptz,
    last_failure_code text,
    dispatched_at timestamptz,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (action_request_id, effect_key),
    check (public.v2_admin_json_is_safe(dispatch_envelope, 16384))
);

create table public.v2_admin_audit_events (
    id bigint generated always as identity primary key,
    event_id uuid not null default gen_random_uuid() unique,
    environment text not null check (
        environment in ('staging', 'production')
    ),
    event_type text not null check (
        event_type ~ '^[a-z0-9_.:-]{2,120}$'
    ),
    outcome text not null check (outcome in ('success', 'denied', 'failed')),
    actor_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    sponsor_principal_id uuid
        references public.v2_admin_principals(id) on delete set null,
    case_id uuid references public.v2_admin_cases(id) on delete set null,
    conversation_id uuid
        references public.v2_support_conversations(id) on delete set null,
    action_request_id uuid
        references public.v2_admin_action_requests(id) on delete set null,
    approval_id uuid
        references public.v2_admin_approvals(id) on delete set null,
    purpose_code text not null check (
        purpose_code ~ '^[a-z0-9_.:-]{2,100}$'
    ),
    permission_snapshot jsonb not null default '{}'::jsonb,
    policy_version text,
    policy_decision text,
    deny_reason_code text,
    object_type text not null check (
        object_type ~ '^[a-z0-9_.:-]{2,100}$'
    ),
    object_id uuid,
    requested_action text,
    executed_action text,
    field_keys text[] not null default '{}',
    sensitivity text not null check (
        sensitivity in ('public', 'internal', 'confidential', 'restricted')
    ),
    step_up_assurance text,
    before_digest text check (
        before_digest is null or before_digest ~ '^[0-9a-f]{64}$'
    ),
    after_digest text check (
        after_digest is null or after_digest ~ '^[0-9a-f]{64}$'
    ),
    correlation_id uuid not null default gen_random_uuid(),
    trace_id text,
    idempotency_key text,
    session_id text,
    client_ip_hash text check (
        client_ip_hash is null or client_ip_hash ~ '^[0-9a-f]{64}$'
    ),
    client_device_hash text check (
        client_device_hash is null or client_device_hash ~ '^[0-9a-f]{64}$'
    ),
    version_snapshot jsonb not null default '{}'::jsonb,
    safe_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    check (public.v2_admin_json_is_safe(permission_snapshot, 32768)),
    check (public.v2_admin_json_is_safe(version_snapshot, 32768)),
    check (public.v2_admin_json_is_safe(safe_metadata, 32768))
);

-- Service-only inbound channel seam. These tables never contain raw provider
-- identities, raw content, raw webhook payloads, OTPs, tokens, or secrets.
create table public.v2_support_webhook_envelopes (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    channel_mode text not null check (
        channel_mode in ('ingest_only', 'shadow', 'live')
    ),
    provider_account_hmac text not null
        check (provider_account_hmac ~ '^[0-9a-f]{64}$'),
    envelope_sha256 text not null
        check (envelope_sha256 ~ '^[0-9a-f]{64}$'),
    received_at timestamptz not null,
    item_count integer not null check (item_count between 0 and 1000),
    processing_status text not null default 'processing'
        check (processing_status in ('processing', 'processed')),
    accepted_items integer not null default 0 check (accepted_items >= 0),
    duplicate_items integer not null default 0 check (duplicate_items >= 0),
    rejected_items integer not null default 0 check (rejected_items >= 0),
    conversation_ids uuid[] not null default '{}',
    case_ids uuid[] not null default '{}',
    shadow_job_ids uuid[] not null default '{}',
    processed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (environment, provider_account_hmac, envelope_sha256)
);

create table public.v2_support_protected_content (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    provider_account_hmac text not null
        check (provider_account_hmac ~ '^[0-9a-f]{64}$'),
    item_hmac text not null check (item_hmac ~ '^[0-9a-f]{64}$'),
    content_kind text not null check (
        content_kind in ('message', 'status', 'provider_error')
    ),
    content_digest_hmac text not null
        check (content_digest_hmac ~ '^[0-9a-f]{64}$'),
    content_encryption_key_id integer not null
        check (content_encryption_key_id > 0),
    contact_lookup_hmac_key_id integer not null
        check (contact_lookup_hmac_key_id > 0),
    provider_id_hmac_key_id integer not null
        check (provider_id_hmac_key_id > 0),
    content_digest_hmac_key_id integer not null
        check (content_digest_hmac_key_id > 0),
    message_id uuid unique
        references public.v2_support_messages(id) on delete cascade,
    algorithm text not null check (
        algorithm in ('xchacha20poly1305', 'aes256gcm')
    ),
    key_ref text not null check (
        key_ref ~ '^[A-Za-z0-9_.:-]{1,120}$'
    ),
    nonce_b64 text not null check (
        nonce_b64 ~ '^[A-Za-z0-9+/]+={0,2}$'
        and char_length(nonce_b64) between 16 and 128
    ),
    ciphertext_b64 text not null check (
        ciphertext_b64 ~ '^[A-Za-z0-9+/]+={0,2}$'
        and char_length(ciphertext_b64) between 16 and 131072
    ),
    aad_sha256 text not null check (aad_sha256 ~ '^[0-9a-f]{64}$'),
    created_at timestamptz not null default now(),
    unique (environment, provider_account_hmac, item_hmac),
    check (content_kind <> 'message' or message_id is not null)
);

create table public.v2_support_message_status_events (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    provider_account_hmac text not null
        check (provider_account_hmac ~ '^[0-9a-f]{64}$'),
    message_id uuid not null
        references public.v2_support_messages(id) on delete cascade,
    event_hmac text not null check (event_hmac ~ '^[0-9a-f]{64}$'),
    delivery_status text not null check (delivery_status in (
        'sent', 'delivered', 'read', 'failed', 'deleted', 'unknown'
    )),
    safe_error_code text check (
        safe_error_code is null
        or safe_error_code ~ '^[A-Za-z0-9_.:-]{1,64}$'
    ),
    error_fingerprint_hmac text check (
        error_fingerprint_hmac is null
        or error_fingerprint_hmac ~ '^[0-9a-f]{64}$'
    ),
    content_digest_hmac text not null
        check (content_digest_hmac ~ '^[0-9a-f]{64}$'),
    provider_occurred_at timestamptz not null,
    received_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique (environment, provider_account_hmac, event_hmac)
);

create table public.v2_admin_shadow_jobs (
    id uuid primary key default gen_random_uuid(),
    environment text not null check (
        environment in ('staging', 'production')
    ),
    channel_mode text not null check (channel_mode in ('shadow', 'live')),
    message_id uuid not null
        references public.v2_support_messages(id) on delete cascade,
    case_id uuid not null
        references public.v2_admin_cases(id) on delete cascade,
    job_kind text not null default 'front_office_shadow'
        check (job_kind = 'front_office_shadow'),
    status text not null default 'pending'
        check (status in ('pending', 'leased', 'completed', 'failed', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (environment, channel_mode, message_id, job_kind)
);

create table public.v2_support_webhook_items (
    id uuid primary key default gen_random_uuid(),
    envelope_id uuid not null
        references public.v2_support_webhook_envelopes(id) on delete cascade,
    environment text not null check (
        environment in ('staging', 'production')
    ),
    provider_account_hmac text not null
        check (provider_account_hmac ~ '^[0-9a-f]{64}$'),
    item_hmac text not null check (item_hmac ~ '^[0-9a-f]{64}$'),
    item_type text not null check (
        item_type in ('message', 'status', 'provider_error')
    ),
    safe_error_code text check (
        safe_error_code is null
        or safe_error_code ~ '^[A-Za-z0-9_.:-]{1,64}$'
    ),
    error_fingerprint_hmac text check (
        error_fingerprint_hmac is null
        or error_fingerprint_hmac ~ '^[0-9a-f]{64}$'
    ),
    accepted boolean not null,
    rejection_code text,
    conversation_id uuid
        references public.v2_support_conversations(id) on delete set null,
    case_id uuid references public.v2_admin_cases(id) on delete set null,
    message_id uuid
        references public.v2_support_messages(id) on delete set null,
    shadow_job_id uuid
        references public.v2_admin_shadow_jobs(id) on delete set null,
    created_at timestamptz not null default now(),
    unique (environment, provider_account_hmac, item_hmac),
    check (
        (accepted and rejection_code is null)
        or (not accepted and rejection_code is not null)
    )
);

create index v2_admin_principals_lookup
    on public.v2_admin_principals(environment, status, principal_type);
create index v2_staff_role_assignments_active
    on public.v2_staff_role_assignments(
        staff_principal_id, environment, valid_from, expires_at
    );
create index v2_support_conversations_inbox
    on public.v2_support_conversations(
        environment, status, last_activity_at desc, id desc
    );
create index v2_support_conversations_identity
    on public.v2_support_conversations(
        channel_identity_id, last_activity_at desc
    );
create index v2_support_messages_conversation
    on public.v2_support_messages(
        conversation_id, server_received_at desc, id desc
    );
create index v2_admin_cases_inbox
    on public.v2_admin_cases(
        environment, status, queue_key, last_activity_at desc, id desc
    );
create index v2_admin_cases_family_child
    on public.v2_admin_cases(family_id, child_id);
create index v2_admin_cases_device
    on public.v2_admin_cases(device_id);
create index v2_admin_cases_incident
    on public.v2_admin_cases(incident_id);
create index v2_admin_cases_owner
    on public.v2_admin_cases(accountable_owner_principal_id, status);
create index v2_admin_case_participants_principal
    on public.v2_admin_case_participants(
        principal_id, removed_at, case_id
    );
create index v2_admin_case_events_case
    on public.v2_admin_case_events(case_id, occurred_at desc, id desc);
create index v2_agent_delegations_active
    on public.v2_agent_delegations(
        agent_principal_id, case_id, status, expires_at
    );
create index v2_admin_action_requests_case
    on public.v2_admin_action_requests(case_id, status, created_at desc);
create index v2_admin_approvals_action
    on public.v2_admin_approvals(
        action_request_id, approval_kind, decided_at desc
    );
create index v2_admin_outbox_pending
    on public.v2_admin_outbox(status, not_before, created_at)
    where status in ('pending', 'failed_retryable');
create index v2_admin_audit_case
    on public.v2_admin_audit_events(case_id, created_at desc, id desc);
create index v2_admin_audit_actor
    on public.v2_admin_audit_events(actor_principal_id, created_at desc);
create index v2_admin_audit_correlation
    on public.v2_admin_audit_events(correlation_id);
create index v2_support_webhook_envelopes_received
    on public.v2_support_webhook_envelopes(
        environment, received_at desc
    );
create index v2_support_webhook_items_envelope
    on public.v2_support_webhook_items(envelope_id, created_at);
create index v2_support_status_message
    on public.v2_support_message_status_events(
        message_id, provider_occurred_at desc
    );
create index v2_admin_shadow_jobs_pending
    on public.v2_admin_shadow_jobs(environment, status, created_at)
    where status = 'pending';

create or replace function public.v2_admin_keep_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'control_tower_append_only'
        using errcode = '23514';
end;
$$;

create or replace function public.v2_admin_guard_staff_principal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if not exists (
        select 1
          from public.v2_admin_principals principal
         where principal.id = new.principal_id
           and principal.principal_type = 'staff'
    ) then
        raise exception 'staff_principal_required'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create or replace function public.v2_admin_guard_agent_principal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if not exists (
        select 1
          from public.v2_admin_principals principal
         where principal.id = new.principal_id
           and principal.principal_type in ('agent', 'service')
    ) then
        raise exception 'agent_or_service_principal_required'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create or replace function public.v2_admin_guard_staff_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if not exists (
        select 1
          from public.v2_admin_principals principal
          join public.v2_staff_profiles profile
            on profile.principal_id = principal.id
         where principal.id = new.staff_principal_id
           and principal.principal_type = 'staff'
           and principal.environment = new.environment
    ) then
        raise exception 'valid_staff_assignment_required'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger v2_staff_profiles_guard_principal
before insert or update on public.v2_staff_profiles
for each row execute function public.v2_admin_guard_staff_principal();

create trigger v2_agent_identities_guard_principal
before insert or update on public.v2_agent_identities
for each row execute function public.v2_admin_guard_agent_principal();

create trigger v2_staff_role_assignments_guard_staff
before insert or update on public.v2_staff_role_assignments
for each row execute function public.v2_admin_guard_staff_assignment();

create trigger v2_admin_case_events_immutable
before update or delete on public.v2_admin_case_events
for each row execute function public.v2_admin_keep_append_only();

create trigger v2_admin_approvals_immutable
before update or delete on public.v2_admin_approvals
for each row execute function public.v2_admin_keep_append_only();

create trigger v2_admin_audit_events_immutable
before update or delete on public.v2_admin_audit_events
for each row execute function public.v2_admin_keep_append_only();

create trigger v2_support_protected_content_immutable
before update or delete on public.v2_support_protected_content
for each row execute function public.v2_admin_keep_append_only();

create trigger v2_support_status_events_immutable
before update or delete on public.v2_support_message_status_events
for each row execute function public.v2_admin_keep_append_only();

create trigger v2_admin_principals_set_updated_at
before update on public.v2_admin_principals
for each row execute function public.v2_set_updated_at();
create trigger v2_staff_profiles_set_updated_at
before update on public.v2_staff_profiles
for each row execute function public.v2_set_updated_at();
create trigger v2_agent_identities_set_updated_at
before update on public.v2_agent_identities
for each row execute function public.v2_set_updated_at();
create trigger v2_support_contacts_set_updated_at
before update on public.v2_support_contacts
for each row execute function public.v2_set_updated_at();
create trigger v2_support_channel_identities_set_updated_at
before update on public.v2_support_channel_identities
for each row execute function public.v2_set_updated_at();
create trigger v2_support_conversations_set_updated_at
before update on public.v2_support_conversations
for each row execute function public.v2_set_updated_at();
create trigger v2_admin_cases_set_updated_at
before update on public.v2_admin_cases
for each row execute function public.v2_set_updated_at();
create trigger v2_admin_action_requests_set_updated_at
before update on public.v2_admin_action_requests
for each row execute function public.v2_set_updated_at();
create trigger v2_admin_outbox_set_updated_at
before update on public.v2_admin_outbox
for each row execute function public.v2_set_updated_at();
create trigger v2_admin_shadow_jobs_set_updated_at
before update on public.v2_admin_shadow_jobs
for each row execute function public.v2_set_updated_at();

insert into public.v2_staff_roles(role_key, display_name)
values
    ('ceo', 'Chief Executive Officer'),
    ('platform_super_admin', 'Platform Super Admin'),
    ('support_manager', 'Support Manager'),
    ('support_agent', 'Support Agent'),
    ('device_support', 'Device Support'),
    ('finance', 'Finance'),
    ('trust_and_safety', 'Trust and Safety'),
    ('privacy_dpo', 'Privacy and DPO'),
    ('security_sre', 'Security and SRE'),
    ('growth_product_data', 'Growth Product and Data'),
    ('auditor', 'Auditor');

insert into public.v2_staff_permissions(
    permission_key,
    risk_class,
    description
)
values
    ('control.session.read', 'r0_masked', 'Read own staff session'),
    ('fixture.read', 'r0_masked', 'Read deterministic synthetic fixtures'),
    ('inbox.read', 'r0_masked', 'Read scoped inbox metadata'),
    ('conversation.read', 'r0_masked', 'Read scoped conversation metadata'),
    ('case.read.assigned', 'r0_masked', 'Read assigned cases'),
    ('case.read.all', 'r0_masked', 'Read all cases in environment'),
    ('message.read.redacted', 'r0_masked', 'Read redacted support messages'),
    ('service360.read.masked', 'r0_masked', 'Read masked Service 360'),
    ('device.install.read', 'r0_masked', 'Read install lifecycle'),
    ('device.health.read', 'r0_masked', 'Read device health projection'),
    ('device.command_lifecycle.read', 'r0_masked', 'Read command lifecycle without payload'),
    ('safety.parent_safe.read', 'r0_sensitive', 'Read one confirmed parent-safe incident'),
    ('audit.read', 'r0_sensitive', 'Read Control Tower audit evidence'),
    ('iam.read', 'r0_sensitive', 'Read staff IAM metadata');

insert into public.v2_staff_role_permissions(role_key, permission_key)
select 'ceo', permission.permission_key
  from public.v2_staff_permissions permission;

insert into public.v2_staff_role_permissions(role_key, permission_key)
values
    ('platform_super_admin', 'control.session.read'),
    ('platform_super_admin', 'case.read.assigned'),
    ('platform_super_admin', 'case.read.all'),
    ('platform_super_admin', 'inbox.read'),
    ('platform_super_admin', 'conversation.read'),
    ('platform_super_admin', 'audit.read'),
    ('platform_super_admin', 'iam.read'),
    ('support_manager', 'control.session.read'),
    ('support_manager', 'fixture.read'),
    ('support_manager', 'inbox.read'),
    ('support_manager', 'conversation.read'),
    ('support_manager', 'case.read.all'),
    ('support_manager', 'case.read.assigned'),
    ('support_manager', 'message.read.redacted'),
    ('support_manager', 'service360.read.masked'),
    ('support_manager', 'device.install.read'),
    ('support_manager', 'device.health.read'),
    ('support_manager', 'device.command_lifecycle.read'),
    ('support_agent', 'control.session.read'),
    ('support_agent', 'fixture.read'),
    ('support_agent', 'inbox.read'),
    ('support_agent', 'conversation.read'),
    ('support_agent', 'case.read.assigned'),
    ('support_agent', 'message.read.redacted'),
    ('support_agent', 'service360.read.masked'),
    ('support_agent', 'device.install.read'),
    ('support_agent', 'device.health.read'),
    ('device_support', 'control.session.read'),
    ('device_support', 'fixture.read'),
    ('device_support', 'inbox.read'),
    ('device_support', 'conversation.read'),
    ('device_support', 'case.read.assigned'),
    ('device_support', 'service360.read.masked'),
    ('device_support', 'device.install.read'),
    ('device_support', 'device.health.read'),
    ('device_support', 'device.command_lifecycle.read'),
    ('trust_and_safety', 'control.session.read'),
    ('trust_and_safety', 'inbox.read'),
    ('trust_and_safety', 'conversation.read'),
    ('trust_and_safety', 'case.read.assigned'),
    ('trust_and_safety', 'message.read.redacted'),
    ('trust_and_safety', 'safety.parent_safe.read'),
    ('auditor', 'control.session.read'),
    ('auditor', 'case.read.assigned'),
    ('auditor', 'case.read.all'),
    ('auditor', 'audit.read');

insert into public.v2_admin_principals(
    id, principal_type, principal_key, display_name, environment, status
)
values
    ('c1000000-0000-4000-8000-000000000001', 'service',
     'control_tower.audit_writer', 'Control Tower Audit Writer',
     'staging', 'active'),
    ('c1000000-0000-4000-8000-000000000002', 'service',
     'control_tower.channel_ingest', 'Control Tower Channel Ingest',
     'staging', 'active'),
    ('c1000000-0000-4000-8000-000000000003', 'service',
     'control_tower.bootstrap', 'Control Tower Bootstrap',
     'staging', 'active'),
    ('c1000000-0000-4000-8000-000000000004', 'service',
     'control_tower.case_workflow', 'Control Tower Case Workflow',
     'staging', 'active'),
    ('c1000000-0000-4000-8000-000000000005', 'agent',
     'control_tower.front_office_v1', 'Front Office V1 Shadow',
     'staging', 'shadow');

insert into public.v2_agent_identities(
    principal_id, agent_kind, domain_key, agent_version,
    tool_allowlist, sponsor_required
)
values
    ('c1000000-0000-4000-8000-000000000001', 'audit_writer',
     'audit', 'ct-r0-v1', '{}', false),
    ('c1000000-0000-4000-8000-000000000002', 'workflow_service',
     'channel_ingest', 'ct-r0-v1', '{}', false),
    ('c1000000-0000-4000-8000-000000000003', 'policy_service',
     'iam_bootstrap', 'ct-r0-v1', '{}', false),
    ('c1000000-0000-4000-8000-000000000004', 'workflow_service',
     'case_workflow', 'ct-r0-v1', '{}', false),
    ('c1000000-0000-4000-8000-000000000005', 'front_office',
     'customer_support', 'ct-r0-v1', '{}', true);

insert into public.v2_admin_fixture_snapshots(
    fixture_key, title, service360_document
)
values (
    'monitoring_interrupted',
    'Synthetic monitoring interrupted fixture',
    jsonb_build_object(
        'schema_version', 1,
        'fixture', true,
        'family', jsonb_build_object(
            'value', 'Synthetic Family',
            'source', 'fixture.monitoring_interrupted',
            'availability', 'EXISTING_V2',
            'freshness_status', 'fresh',
            'sensitivity', 'internal',
            'redaction', 'synthetic'
        ),
        'child', jsonb_build_object(
            'value', 'Synthetic Child',
            'source', 'fixture.monitoring_interrupted',
            'availability', 'EXISTING_V2',
            'freshness_status', 'fresh',
            'sensitivity', 'confidential',
            'redaction', 'synthetic'
        ),
        'monitoring', jsonb_build_object(
            'value', 'interrupted',
            'source', 'fixture.monitoring_interrupted',
            'availability', 'EXISTING_V2',
            'freshness_status', 'interrupted',
            'sensitivity', 'confidential',
            'redaction', 'none'
        ),
        'capabilities', jsonb_build_object(
            'value', jsonb_build_array(
                jsonb_build_object(
                    'key', 'accessibility_enabled', 'state', 'DENIED'
                ),
                jsonb_build_object(
                    'key', 'notification_listener_enabled',
                    'state', 'GRANTED'
                ),
                jsonb_build_object(
                    'key', 'app_notifications_allowed',
                    'state', 'UNKNOWN'
                ),
                jsonb_build_object(
                    'key', 'battery_optimization_exempt',
                    'state', 'DENIED'
                ),
                jsonb_build_object(
                    'key', 'oem_autostart_review', 'state', 'UNKNOWN'
                ),
                jsonb_build_object(
                    'key', 'usage_access', 'state', 'UNKNOWN'
                ),
                jsonb_build_object(
                    'key', 'precise_location', 'state', 'UNKNOWN'
                ),
                jsonb_build_object(
                    'key', 'background_location', 'state', 'UNKNOWN'
                ),
                jsonb_build_object(
                    'key', 'location_services', 'state', 'UNKNOWN'
                ),
                jsonb_build_object(
                    'key', 'package_inventory', 'state', 'UNKNOWN'
                )
            ),
            'source', 'fixture.monitoring_interrupted.allowlist',
            'availability', 'EXISTING_V2',
            'freshness_status', 'interrupted',
            'sensitivity', 'confidential',
            'redaction', 'synthetic_allowlist'
        ),
        'parental_controls', jsonb_build_object(
            'value', null,
            'source', 'none',
            'availability', 'NEW_DOMAIN_REQUIRED',
            'freshness_status', 'unknown',
            'sensitivity', 'restricted',
            'redaction', 'not_collected'
        )
    )
);

insert into public.v2_support_contacts(
    id, environment, contact_kind, contact_hash, display_label_redacted
)
values (
    'c2000000-0000-4000-8000-000000000001',
    'staging', 'parent', repeat('a', 64), 'Synthetic contact'
);

insert into public.v2_support_channel_identities(
    id, environment, contact_id, channel, provider_account_key,
    provider_identity_hash, display_identity_redacted
)
values (
    'c3000000-0000-4000-8000-000000000001',
    'staging',
    'c2000000-0000-4000-8000-000000000001',
    'fixture', repeat('b', 64), repeat('c', 64), 'Fixture channel'
);

insert into public.v2_support_conversations(
    id, environment, source_mode, channel_identity_id, channel,
    status, verification_level, last_activity_at
)
values (
    'c4000000-0000-4000-8000-000000000001',
    'staging', 'fixture',
    'c3000000-0000-4000-8000-000000000001',
    'fixture', 'open', 'v2_guardian', now()
);

insert into public.v2_support_messages(
    id, environment, conversation_id, direction, message_type,
    ingest_status, delivery_status, redacted_text,
    server_received_at, retention_class, sensitivity
)
values (
    'c6000000-0000-4000-8000-000000000001',
    'staging', 'c4000000-0000-4000-8000-000000000001',
    'internal', 'internal_note', 'persisted', 'not_applicable',
    'Synthetic fixture note: monitoring is interrupted.',
    now(), 'synthetic_fixture', 'internal'
);

insert into public.v2_admin_cases(
    id, environment, source_mode, fixture_key, domain_key,
    category_key, intent_key, priority, status, queue_key,
    purpose_code, sensitivity, privacy_class, verification_level,
    last_activity_at
)
values (
    'c5000000-0000-4000-8000-000000000001',
    'staging', 'fixture', 'monitoring_interrupted',
    'device_support', 'monitoring', 'recover_monitoring',
    's1', 'working', 'device_support', 'fixture_review',
    'confidential', 'synthetic', 'v2_guardian', now()
);

insert into public.v2_admin_case_conversations(
    case_id, conversation_id, is_primary
)
values (
    'c5000000-0000-4000-8000-000000000001',
    'c4000000-0000-4000-8000-000000000001',
    true
);

insert into public.v2_admin_case_events(
    case_id, event_type, actor_principal_id, reason_code, safe_metadata
)
values (
    'c5000000-0000-4000-8000-000000000001',
    'fixture.case_created',
    'c1000000-0000-4000-8000-000000000004',
    'synthetic_fixture',
    '{"fixture":true}'::jsonb
);

insert into public.v2_admin_action_requests(
    id, environment, case_id, requested_by_principal_id,
    action_key, risk_class, status, resource_type, purpose_code,
    policy_version, request_payload_sanitized, action_hash,
    idempotency_key, expires_at
)
values (
    'c7000000-0000-4000-8000-000000000001',
    'staging', 'c5000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000005',
    'device.report_heartbeat', 'r2', 'denied', 'device',
    'fixture_review', 'ct-r0-v1', '{"fixture":true}'::jsonb,
    repeat('d', 64), 'fixture-action-denied-0001',
    now() + interval '15 minutes'
);

insert into public.v2_admin_approvals(
    id, action_request_id, approval_kind, decision,
    approver_principal_id, action_hash, assurance_level,
    evidence_ref, expires_at
)
values (
    'c7100000-0000-4000-8000-000000000001',
    'c7000000-0000-4000-8000-000000000001',
    'policy', 'declined',
    'c1000000-0000-4000-8000-000000000003',
    repeat('d', 64), 'service_policy',
    'fixture-policy-denial-0001', now() + interval '15 minutes'
);

insert into public.v2_admin_outbox(
    id, action_request_id, effect_key, destination_kind,
    dispatch_envelope, status, idempotency_key
)
values (
    'c7200000-0000-4000-8000-000000000001',
    'c7000000-0000-4000-8000-000000000001',
    'fixture.cancelled', 'none', '{"fixture":true}'::jsonb,
    'cancelled', 'fixture-outbox-cancelled-0001'
);

insert into public.v2_admin_audit_events(
    environment, event_type, outcome, actor_principal_id,
    case_id, action_request_id, approval_id, purpose_code,
    policy_version, policy_decision, deny_reason_code,
    object_type, object_id, requested_action, field_keys,
    sensitivity, version_snapshot, safe_metadata
)
values (
    'staging', 'fixture.action_denied', 'denied',
    'c1000000-0000-4000-8000-000000000003',
    'c5000000-0000-4000-8000-000000000001',
    'c7000000-0000-4000-8000-000000000001',
    'c7100000-0000-4000-8000-000000000001',
    'fixture_review', 'ct-r0-v1', 'deny', 'read_only_phase',
    'action_request', 'c7000000-0000-4000-8000-000000000001',
    'device.report_heartbeat', array['status'], 'internal',
    '{"contract":"ct-r0-v1"}'::jsonb,
    '{"fixture":true}'::jsonb
);

do $$
declare
    table_name text;
begin
    foreach table_name in array array[
        'v2_admin_principals',
        'v2_staff_profiles',
        'v2_agent_identities',
        'v2_staff_roles',
        'v2_staff_permissions',
        'v2_staff_role_permissions',
        'v2_staff_role_assignments',
        'v2_admin_fixture_snapshots',
        'v2_support_contacts',
        'v2_support_channel_identities',
        'v2_support_conversations',
        'v2_support_messages',
        'v2_admin_cases',
        'v2_admin_case_conversations',
        'v2_admin_case_participants',
        'v2_admin_case_events',
        'v2_agent_delegations',
        'v2_admin_action_requests',
        'v2_admin_approvals',
        'v2_admin_outbox',
        'v2_admin_audit_events',
        'v2_support_webhook_envelopes',
        'v2_support_protected_content',
        'v2_support_message_status_events',
        'v2_admin_shadow_jobs',
        'v2_support_webhook_items'
    ]
    loop
        execute format(
            'alter table public.%I enable row level security',
            table_name
        );
        execute format(
            'alter table public.%I force row level security',
            table_name
        );
        execute format(
            'revoke all on table public.%I from public, anon, authenticated, service_role',
            table_name
        );
    end loop;
end
$$;

revoke all on sequence public.v2_admin_cases_case_number_seq
from public, anon, authenticated, service_role;
revoke all on sequence public.v2_admin_case_events_id_seq
from public, anon, authenticated, service_role;
revoke all on sequence public.v2_admin_audit_events_id_seq
from public, anon, authenticated, service_role;

create or replace function public.v2_admin_current_staff_principal()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select principal.id
      from public.v2_staff_profiles profile
      join public.v2_admin_principals principal
        on principal.id = profile.principal_id
     where profile.auth_user_id = auth.uid()
       and principal.principal_type = 'staff'
       and principal.environment = 'staging'
       and principal.status = 'active'
       and coalesce(auth.jwt()->>'aal', '') = 'aal2'
     limit 1;
$$;

create or replace function public.v2_admin_has_permission(
    target_permission_key text,
    target_case_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from public.v2_admin_principals principal
          join public.v2_staff_role_assignments assignment
            on assignment.staff_principal_id = principal.id
           and assignment.environment = principal.environment
           and assignment.valid_from <= now()
           and (
               assignment.expires_at is null
               or assignment.expires_at > now()
           )
          join public.v2_staff_roles role
            on role.role_key = assignment.role_key
           and role.is_active
          join public.v2_staff_role_permissions role_permission
            on role_permission.role_key = role.role_key
           and role_permission.permission_key = target_permission_key
          left join public.v2_admin_cases admin_case
            on admin_case.id = target_case_id
         where principal.id = public.v2_admin_current_staff_principal()
           and (
               assignment.scope_type = 'global'
               or (
                   target_case_id is not null
                   and assignment.scope_type = 'case'
                   and assignment.scope_key = target_case_id::text
               )
               or (
                   target_case_id is not null
                   and assignment.scope_type = 'queue'
                   and assignment.scope_key = admin_case.queue_key
               )
           )
    );
$$;

create or replace function public.v2_admin_can_read_case(
    target_case_id uuid,
    target_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
          from public.v2_admin_cases admin_case
          join public.v2_admin_principals principal
            on principal.id = public.v2_admin_current_staff_principal()
           and principal.environment = admin_case.environment
         where admin_case.id = target_case_id
           and public.v2_admin_has_permission(
               target_permission_key,
               target_case_id
           )
           and (
               public.v2_admin_has_permission(
                   'case.read.all',
                   target_case_id
               )
               or (
                   public.v2_admin_has_permission(
                       'case.read.assigned',
                       target_case_id
                   )
                   and (
                       admin_case.accountable_owner_principal_id = principal.id
                       or admin_case.resolver_principal_id = principal.id
                       or admin_case.human_supervisor_principal_id = principal.id
                       or exists (
                           select 1
                             from public.v2_admin_case_participants participant
                            where participant.case_id = admin_case.id
                              and participant.principal_id = principal.id
                              and participant.removed_at is null
                       )
                   )
               )
           )
    );
$$;

create or replace function public.v2_admin_write_audit_event(
    target_event_type text,
    target_outcome text,
    target_case_id uuid,
    target_conversation_id uuid,
    target_object_type text,
    target_object_id uuid,
    target_purpose_code text,
    target_field_keys text[],
    target_reason_code text,
    target_correlation_id uuid,
    target_safe_metadata jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
    staff_principal_id uuid;
    staff_environment text;
    audit_id bigint;
    permission_keys text[];
begin
    staff_principal_id := public.v2_admin_current_staff_principal();
    if staff_principal_id is null then
        raise exception 'staff_not_authorized' using errcode = '42501';
    end if;
    if target_outcome not in ('success', 'denied', 'failed')
       or target_event_type !~ '^[a-z0-9_.:-]{2,120}$'
       or target_object_type !~ '^[a-z0-9_.:-]{2,100}$'
       or target_purpose_code !~ '^[a-z0-9_.:-]{2,100}$'
       or not public.v2_admin_json_is_safe(
           coalesce(target_safe_metadata, '{}'::jsonb),
           32768
       ) then
        raise exception 'invalid_admin_audit_event' using errcode = '22023';
    end if;

    select principal.environment
      into staff_environment
      from public.v2_admin_principals principal
     where principal.id = staff_principal_id;

    select coalesce(array_agg(distinct role_permission.permission_key), '{}')
      into permission_keys
      from public.v2_staff_role_assignments assignment
      join public.v2_staff_role_permissions role_permission
        on role_permission.role_key = assignment.role_key
     where assignment.staff_principal_id = staff_principal_id
       and assignment.environment = staff_environment
       and assignment.valid_from <= now()
       and (assignment.expires_at is null or assignment.expires_at > now());

    insert into public.v2_admin_audit_events (
        environment,
        event_type,
        outcome,
        actor_principal_id,
        case_id,
        conversation_id,
        purpose_code,
        permission_snapshot,
        deny_reason_code,
        object_type,
        object_id,
        requested_action,
        field_keys,
        sensitivity,
        correlation_id,
        session_id,
        version_snapshot,
        safe_metadata
    )
    values (
        staff_environment,
        target_event_type,
        target_outcome,
        staff_principal_id,
        target_case_id,
        target_conversation_id,
        target_purpose_code,
        jsonb_build_object('permission_keys', permission_keys),
        target_reason_code,
        target_object_type,
        target_object_id,
        target_event_type,
        coalesce(target_field_keys, '{}'),
        case
            when target_outcome = 'denied' then 'restricted'
            else 'confidential'
        end,
        coalesce(target_correlation_id, gen_random_uuid()),
        nullif(auth.jwt()->>'session_id', ''),
        '{"contract":"ct-r0-v1"}'::jsonb,
        coalesce(target_safe_metadata, '{}'::jsonb)
    )
    returning id into audit_id;

    return audit_id;
end;
$$;

create or replace function public.v2_admin_field_envelope(
    target_value jsonb,
    target_source text,
    target_observed_at timestamptz,
    target_received_at timestamptz,
    target_effective_at timestamptz,
    target_freshness_status text,
    target_sensitivity text,
    target_redaction text,
    target_revision_or_etag text,
    target_availability text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
    select jsonb_build_object(
        'value', target_value,
        'source', target_source,
        'observed_at', target_observed_at,
        'received_at', target_received_at,
        'effective_at', target_effective_at,
        'freshness_status', target_freshness_status,
        'sensitivity', target_sensitivity,
        'redaction', target_redaction,
        'revision_or_etag', target_revision_or_etag,
        'availability', target_availability
    );
$$;

create or replace function public.v2_admin_provision_staff_service(
    target_user_id uuid,
    target_display_name text,
    target_role_keys text[],
    target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    staff_principal_id uuid;
    role_key_value text;
begin
    if target_user_id is null
       or char_length(target_display_name) not between 1 and 120
       or target_role_keys is null
       or cardinality(target_role_keys) < 1
       or char_length(target_reason) not between 2 and 120
       or not exists (
           select 1 from auth.users user_row
            where user_row.id = target_user_id
       )
       or exists (
           select 1 from unnest(target_role_keys) role_value
            where not exists (
                select 1 from public.v2_staff_roles role
                 where role.role_key = role_value
                   and role.is_active
            )
       ) then
        raise exception 'invalid_staff_provisioning_request'
            using errcode = '22023';
    end if;

    select profile.principal_id
      into staff_principal_id
      from public.v2_staff_profiles profile
     where profile.auth_user_id = target_user_id;

    if staff_principal_id is null then
        insert into public.v2_admin_principals (
            principal_type,
            principal_key,
            display_name,
            environment,
            status
        )
        values (
            'staff',
            'staff:' || target_user_id::text,
            target_display_name,
            'staging',
            'active'
        )
        returning id into staff_principal_id;

        insert into public.v2_staff_profiles(
            principal_id,
            auth_user_id
        )
        values (staff_principal_id, target_user_id);
    else
        update public.v2_admin_principals
           set display_name = target_display_name,
               status = 'active'
         where id = staff_principal_id
           and environment = 'staging';
    end if;

    foreach role_key_value in array target_role_keys
    loop
        insert into public.v2_staff_role_assignments (
            staff_principal_id,
            role_key,
            environment,
            scope_type,
            granted_by_principal_id,
            reason_code
        )
        values (
            staff_principal_id,
            role_key_value,
            'staging',
            'global',
            'c1000000-0000-4000-8000-000000000003',
            target_reason
        )
        on conflict do nothing;
    end loop;

    insert into public.v2_admin_audit_events (
        environment,
        event_type,
        outcome,
        actor_principal_id,
        purpose_code,
        object_type,
        object_id,
        requested_action,
        field_keys,
        sensitivity,
        version_snapshot,
        safe_metadata
    )
    values (
        'staging',
        'iam.staff_provisioned',
        'success',
        'c1000000-0000-4000-8000-000000000003',
        'staging_bootstrap',
        'staff_principal',
        staff_principal_id,
        'staff.provision',
        array['roles'],
        'restricted',
        '{"contract":"ct-r0-v1"}'::jsonb,
        jsonb_build_object(
            'role_keys', target_role_keys,
            'reason_code', target_reason
        )
    );

    return staff_principal_id;
end;
$$;

create or replace function public.v2_admin_denied_response(
    target_case_id uuid,
    target_conversation_id uuid,
    target_object_type text,
    target_object_id uuid,
    target_purpose_code text,
    target_reason_code text,
    target_field_keys text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    audit_id bigint;
begin
    audit_id := public.v2_admin_write_audit_event(
        'access.denied',
        'denied',
        case when exists (
            select 1
              from public.v2_admin_cases admin_case
             where admin_case.id = target_case_id
        ) then target_case_id else null end,
        case when exists (
            select 1
              from public.v2_support_conversations conversation
             where conversation.id = target_conversation_id
        ) then target_conversation_id else null end,
        target_object_type,
        target_object_id,
        target_purpose_code,
        target_field_keys,
        target_reason_code,
        gen_random_uuid(),
        jsonb_build_object('reason_code', target_reason_code)
    );
    return jsonb_build_object(
        'schema_version', 1,
        'generated_at', now(),
        'data', null,
        'error', jsonb_build_object(
            'code', target_reason_code,
            'message', 'Access denied by Control Tower policy.'
        ),
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_get_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    staff_principal_id uuid;
    result_data jsonb;
begin
    if coalesce(auth.jwt()->>'aal', '') <> 'aal2' then
        raise exception 'staff_mfa_required' using errcode = '42501';
    end if;

    staff_principal_id := public.v2_admin_current_staff_principal();
    if staff_principal_id is null then
        raise exception 'staff_not_authorized' using errcode = '42501';
    end if;

    select jsonb_build_object(
        'principal_id', principal.id,
        'display_name', principal.display_name,
        'environment', principal.environment,
        'status', principal.status,
        'aal', coalesce(auth.jwt()->>'aal', 'unknown'),
        'roles', coalesce((
            select jsonb_agg(distinct assignment.role_key)
              from public.v2_staff_role_assignments assignment
             where assignment.staff_principal_id = principal.id
               and assignment.environment = principal.environment
               and assignment.valid_from <= now()
               and (
                   assignment.expires_at is null
                   or assignment.expires_at > now()
               )
        ), '[]'::jsonb),
        'permissions', coalesce((
            select jsonb_agg(distinct role_permission.permission_key)
              from public.v2_staff_role_assignments assignment
              join public.v2_staff_role_permissions role_permission
                on role_permission.role_key = assignment.role_key
             where assignment.staff_principal_id = principal.id
               and assignment.environment = principal.environment
               and assignment.valid_from <= now()
               and (
                   assignment.expires_at is null
                   or assignment.expires_at > now()
               )
        ), '[]'::jsonb)
    )
      into result_data
      from public.v2_admin_principals principal
     where principal.id = staff_principal_id;

    return jsonb_build_object(
        'schema_version', 1,
        'generated_at', now(),
        'source_mode', 'staging',
        'data', result_data,
        'page', null,
        'audit_event_id', null
    );
end;
$$;

create or replace function public.v2_admin_list_fixture_scenarios()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
    audit_id bigint;
begin
    if not public.v2_admin_has_permission('fixture.read', null) then
        return public.v2_admin_denied_response(
            null, null, 'fixture_catalog', null,
            'fixture_review', 'permission_denied', array['fixture_key']
        );
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'fixture_key', fixture.fixture_key,
        'schema_version', fixture.schema_version,
        'title', fixture.title,
        'created_at', fixture.created_at
    ) order by fixture.fixture_key), '[]'::jsonb)
      into result_data
      from public.v2_admin_fixture_snapshots fixture;

    audit_id := public.v2_admin_write_audit_event(
        'fixture.catalog_read', 'success', null, null,
        'fixture_catalog', null, 'fixture_review',
        array['fixture_key', 'title'], null, gen_random_uuid(),
        jsonb_build_object('result_count', jsonb_array_length(result_data))
    );

    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', 'fixture', 'data', result_data,
        'page', null, 'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_list_inbox(
    target_source_mode text,
    target_queue_key text default null,
    target_case_status text default null,
    target_before_last_activity_at timestamptz default null,
    target_before_conversation_id uuid default null,
    target_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    staff_principal_id uuid;
    result_data jsonb;
    audit_id bigint;
begin
    if target_source_mode not in ('fixture', 'staging')
       or target_limit not between 1 and 100
       or ((target_before_conversation_id is null)
           <> (target_before_last_activity_at is null)) then
        raise exception 'invalid_inbox_query' using errcode = '22023';
    end if;
    if not public.v2_admin_has_permission('inbox.read', null)
       or (
           target_source_mode = 'fixture'
           and not public.v2_admin_has_permission('fixture.read', null)
       ) then
        return public.v2_admin_denied_response(
            null, null, 'inbox', null,
            'support_inbox', 'permission_denied', array['case_metadata']
        );
    end if;

    staff_principal_id := public.v2_admin_current_staff_principal();
    select coalesce(jsonb_agg(item.payload order by item.last_activity_at desc, item.conversation_id desc), '[]'::jsonb)
      into result_data
      from (
        select
            conversation.id conversation_id,
            conversation.last_activity_at,
            jsonb_build_object(
                'conversation_id', conversation.id,
                'conversation_status', conversation.status,
                'channel', conversation.channel,
                'verification_level', conversation.verification_level,
                'contact_label', contact.display_label_redacted,
                'last_activity_at', conversation.last_activity_at,
                'case_id', admin_case.id,
                'case_number', admin_case.case_number,
                'case_status', admin_case.status,
                'priority', admin_case.priority,
                'queue_key', admin_case.queue_key,
                'domain_key', admin_case.domain_key,
                'sla_deadline_at', admin_case.sla_deadline_at
            ) payload
          from public.v2_support_conversations conversation
          join public.v2_support_channel_identities identity_row
            on identity_row.id = conversation.channel_identity_id
          join public.v2_support_contacts contact
            on contact.id = identity_row.contact_id
          left join public.v2_admin_case_conversations link
            on link.conversation_id = conversation.id
           and link.is_primary
          left join public.v2_admin_cases admin_case
            on admin_case.id = link.case_id
         where conversation.environment = 'staging'
           and conversation.source_mode = target_source_mode
           and (target_queue_key is null or admin_case.queue_key = target_queue_key)
           and (target_case_status is null or admin_case.status = target_case_status)
           and (
               target_before_last_activity_at is null
               or (conversation.last_activity_at, conversation.id) <
                  (target_before_last_activity_at, target_before_conversation_id)
           )
           and (
               (admin_case.id is not null and public.v2_admin_can_read_case(
                   admin_case.id, 'inbox.read'
               ))
               or (admin_case.id is null and public.v2_admin_has_permission(
                   'case.read.all', null
               ))
           )
         order by conversation.last_activity_at desc, conversation.id desc
         limit target_limit
      ) item;

    audit_id := public.v2_admin_write_audit_event(
        'inbox.read', 'success', null, null, 'inbox', null,
        'support_inbox', array['case_metadata'], null,
        gen_random_uuid(),
        jsonb_build_object(
            'source_mode', target_source_mode,
            'result_count', jsonb_array_length(result_data)
        )
    );
    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', target_source_mode, 'data', result_data,
        'page', jsonb_build_object('limit', target_limit),
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_get_conversation(
    target_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_case_id uuid;
    result_data jsonb;
    audit_id bigint;
begin
    select link.case_id
      into target_case_id
      from public.v2_admin_case_conversations link
     where link.conversation_id = target_conversation_id
       and link.is_primary
     limit 1;

    if not public.v2_admin_has_permission('conversation.read', target_case_id)
       or (
           target_case_id is not null
           and not public.v2_admin_can_read_case(
               target_case_id, 'conversation.read'
           )
       )
       or (
           target_case_id is null
           and not public.v2_admin_has_permission('case.read.all', null)
       ) then
        return public.v2_admin_denied_response(
            target_case_id, target_conversation_id,
            'conversation', target_conversation_id,
            'support_conversation', 'permission_denied',
            array['conversation_metadata']
        );
    end if;

    select jsonb_build_object(
        'conversation_id', conversation.id,
        'source_mode', conversation.source_mode,
        'channel', conversation.channel,
        'status', conversation.status,
        'verification_level', conversation.verification_level,
        'contact_label', contact.display_label_redacted,
        'responder_principal_id', conversation.responder_principal_id,
        'responder_lease_expires_at', conversation.responder_lease_expires_at,
        'last_activity_at', conversation.last_activity_at,
        'created_at', conversation.created_at,
        'closed_at', conversation.closed_at,
        'case_id', target_case_id
    )
      into result_data
      from public.v2_support_conversations conversation
      join public.v2_support_channel_identities identity_row
        on identity_row.id = conversation.channel_identity_id
      join public.v2_support_contacts contact
        on contact.id = identity_row.contact_id
     where conversation.id = target_conversation_id;

    if result_data is null then
        raise exception 'conversation_not_found' using errcode = 'P0002';
    end if;

    audit_id := public.v2_admin_write_audit_event(
        'conversation.read', 'success', target_case_id,
        target_conversation_id, 'conversation', target_conversation_id,
        'support_conversation', array['conversation_metadata'], null,
        gen_random_uuid(), '{}'::jsonb
    );
    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', result_data->>'source_mode', 'data', result_data,
        'page', null, 'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_get_case(
    target_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
    source_mode_value text;
    audit_id bigint;
begin
    if not public.v2_admin_can_read_case(
        target_case_id, 'case.read.assigned'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'case', target_case_id,
            'case_review', 'permission_denied', array['case_metadata']
        );
    end if;

    select admin_case.source_mode,
           jsonb_build_object(
               'case_id', admin_case.id,
               'case_number', admin_case.case_number,
               'source_mode', admin_case.source_mode,
               'domain_key', admin_case.domain_key,
               'category_key', admin_case.category_key,
               'intent_key', admin_case.intent_key,
               'priority', admin_case.priority,
               'status', admin_case.status,
               'substatus', admin_case.substatus,
               'queue_key', admin_case.queue_key,
               'purpose_code', admin_case.purpose_code,
               'sensitivity', admin_case.sensitivity,
               'privacy_class', admin_case.privacy_class,
               'verification_level', admin_case.verification_level,
               'accountable_owner_principal_id',
                   admin_case.accountable_owner_principal_id,
               'resolver_principal_id', admin_case.resolver_principal_id,
               'human_supervisor_principal_id',
                   admin_case.human_supervisor_principal_id,
               'sla_deadline_at', admin_case.sla_deadline_at,
               'wait_deadline_at', admin_case.wait_deadline_at,
               'reopen_count', admin_case.reopen_count,
               'last_activity_at', admin_case.last_activity_at,
               'created_at', admin_case.created_at,
               'closed_at', admin_case.closed_at,
               'conversations', coalesce((
                   select jsonb_agg(jsonb_build_object(
                       'conversation_id', link.conversation_id,
                       'is_primary', link.is_primary,
                       'linked_at', link.linked_at
                   ) order by link.is_primary desc, link.linked_at)
                     from public.v2_admin_case_conversations link
                    where link.case_id = admin_case.id
               ), '[]'::jsonb),
               'participants', coalesce((
                   select jsonb_agg(jsonb_build_object(
                       'principal_id', participant.principal_id,
                       'participant_role', participant.participant_role,
                       'assigned_at', participant.assigned_at
                   ) order by participant.assigned_at)
                     from public.v2_admin_case_participants participant
                    where participant.case_id = admin_case.id
                      and participant.removed_at is null
               ), '[]'::jsonb)
           )
      into source_mode_value, result_data
      from public.v2_admin_cases admin_case
     where admin_case.id = target_case_id;

    audit_id := public.v2_admin_write_audit_event(
        'case.read', 'success', target_case_id, null,
        'case', target_case_id, 'case_review',
        array['case_metadata', 'participants'], null,
        gen_random_uuid(), '{}'::jsonb
    );
    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', source_mode_value, 'data', result_data,
        'page', null, 'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_list_case_messages(
    target_case_id uuid,
    target_before_server_received_at timestamptz default null,
    target_before_message_id uuid default null,
    target_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
    source_mode_value text;
    audit_id bigint;
begin
    if target_limit not between 1 and 100
       or ((target_before_message_id is null)
           <> (target_before_server_received_at is null)) then
        raise exception 'invalid_message_query' using errcode = '22023';
    end if;
    if not public.v2_admin_can_read_case(
        target_case_id, 'message.read.redacted'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'case_messages', target_case_id,
            'message_review', 'permission_denied',
            array['redacted_message']
        );
    end if;
    select source_mode into source_mode_value
      from public.v2_admin_cases where id = target_case_id;

    select coalesce(jsonb_agg(item.payload order by item.server_received_at desc, item.message_id desc), '[]'::jsonb)
      into result_data
      from (
        select message.id message_id,
               message.server_received_at,
               jsonb_build_object(
                   'message_id', message.id,
                   'conversation_id', message.conversation_id,
                   'direction', message.direction,
                   'message_type', message.message_type,
                   'ingest_status', message.ingest_status,
                   'delivery_status', message.delivery_status,
                   'redacted_value', message.redacted_text,
                   'content_available', message.protected_content_ref is not null
                       or exists (
                           select 1
                             from public.v2_support_protected_content protected
                            where protected.message_id = message.id
                       ),
                   'provider_occurred_at', message.provider_occurred_at,
                   'server_received_at', message.server_received_at,
                   'sensitivity', message.sensitivity
               ) payload
          from public.v2_support_messages message
          join public.v2_admin_case_conversations link
            on link.conversation_id = message.conversation_id
           and link.case_id = target_case_id
         where (
             target_before_server_received_at is null
             or (message.server_received_at, message.id) <
                (target_before_server_received_at, target_before_message_id)
         )
         order by message.server_received_at desc, message.id desc
         limit target_limit
      ) item;

    audit_id := public.v2_admin_write_audit_event(
        'message.redacted_read', 'success', target_case_id, null,
        'case_messages', target_case_id, 'message_review',
        array['redacted_message'], null, gen_random_uuid(),
        jsonb_build_object('result_count', jsonb_array_length(result_data))
    );
    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', source_mode_value, 'data', result_data,
        'page', jsonb_build_object('limit', target_limit),
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_list_case_timeline(
    target_case_id uuid,
    target_before_occurred_at timestamptz default null,
    target_before_event_id bigint default null,
    target_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
    source_mode_value text;
    audit_id bigint;
begin
    if target_limit not between 1 and 100
       or ((target_before_event_id is null)
           <> (target_before_occurred_at is null)) then
        raise exception 'invalid_timeline_query' using errcode = '22023';
    end if;
    if not public.v2_admin_can_read_case(
        target_case_id, 'case.read.assigned'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'case_timeline', target_case_id,
            'timeline_review', 'permission_denied', array['timeline']
        );
    end if;
    select source_mode into source_mode_value
      from public.v2_admin_cases where id = target_case_id;

    select coalesce(jsonb_agg(item.payload order by item.occurred_at desc, item.sort_id desc), '[]'::jsonb)
      into result_data
      from (
        select combined.occurred_at,
               combined.sort_id,
               combined.payload
          from (
        select event.occurred_at,
               event.id sort_id,
               jsonb_build_object(
                   'timeline_type', 'case_event',
                   'event_id', event.event_id,
                   'event_type', event.event_type,
                   'previous_status', event.previous_status,
                   'new_status', event.new_status,
                   'actor_principal_id', event.actor_principal_id,
                   'reason_code', event.reason_code,
                   'safe_metadata', event.safe_metadata,
                   'occurred_at', event.occurred_at
               ) payload
          from public.v2_admin_case_events event
         where event.case_id = target_case_id
           and (
               target_before_occurred_at is null
               or (event.occurred_at, event.id) <
                  (target_before_occurred_at, target_before_event_id)
           )
        union all
        select action.created_at,
               -extract(epoch from action.created_at)::bigint sort_id,
               jsonb_build_object(
                   'timeline_type', 'action',
                   'action_id', action.id,
                   'action_key', action.action_key,
                   'risk_class', action.risk_class,
                   'status', action.status,
                   'created_at', action.created_at
               ) payload
          from public.v2_admin_action_requests action
         where action.case_id = target_case_id
           and (
               target_before_occurred_at is null
               or action.created_at < target_before_occurred_at
           )
          ) combined
         order by combined.occurred_at desc, combined.sort_id desc
         limit target_limit
      ) item
    ;

    audit_id := public.v2_admin_write_audit_event(
        'timeline.read', 'success', target_case_id, null,
        'case_timeline', target_case_id, 'timeline_review',
        array['timeline'], null, gen_random_uuid(),
        jsonb_build_object('result_count', jsonb_array_length(result_data))
    );
    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', source_mode_value, 'data', result_data,
        'page', jsonb_build_object('limit', target_limit),
        'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_get_service360(
    target_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    admin_case public.v2_admin_cases%rowtype;
    family_row public.v2_families%rowtype;
    child_row public.v2_children%rowtype;
    device_row public.v2_protected_devices%rowtype;
    monitoring_row public.v2_device_monitoring_state%rowtype;
    health_row public.v2_device_health_events%rowtype;
    install_row public.v2_child_install_sessions%rowtype;
    result_data jsonb;
    monitoring_freshness text := 'unknown';
    install_freshness text := 'unknown';
    commands_data jsonb := '[]'::jsonb;
    push_data jsonb := '{}'::jsonb;
    capabilities_data jsonb := '[]'::jsonb;
    capability_issue_keys text[] := '{}'::text[];
    audit_id bigint;
begin
    if not public.v2_admin_can_read_case(
        target_case_id, 'service360.read.masked'
    ) then
        return public.v2_admin_denied_response(
            target_case_id, null, 'service360', target_case_id,
            'service360_review', 'permission_denied',
            array[
                'family', 'child', 'install', 'device', 'monitoring',
                'capabilities'
            ]
        );
    end if;

    select * into admin_case
      from public.v2_admin_cases
     where id = target_case_id;

    if admin_case.source_mode = 'fixture' then
        select fixture.service360_document
          into result_data
          from public.v2_admin_fixture_snapshots fixture
         where fixture.fixture_key = admin_case.fixture_key;
    else
        if admin_case.environment <> 'staging'
           or admin_case.verification_level not in (
               'v2_guardian', 'v3_action_bound'
           )
           or admin_case.family_id is null then
            return public.v2_admin_denied_response(
                target_case_id, null, 'service360', target_case_id,
                'service360_review', 'guardian_verification_required',
                array['family', 'child', 'device', 'capabilities']
            );
        end if;

        select * into family_row
          from public.v2_families family
         where family.id = admin_case.family_id;

        if admin_case.child_id is not null then
            select * into child_row
              from public.v2_children child
             where child.id = admin_case.child_id
               and child.family_id = admin_case.family_id;
            if child_row.id is null then
                return public.v2_admin_denied_response(
                    target_case_id, null, 'service360', target_case_id,
                    'service360_review', 'case_resource_mismatch',
                    array['child']
                );
            end if;
        end if;

        if admin_case.device_id is not null then
            select device.* into device_row
              from public.v2_protected_devices device
              join public.v2_children child on child.id = device.child_id
             where device.id = admin_case.device_id
               and child.family_id = admin_case.family_id
               and (
                   admin_case.child_id is null
                   or child.id = admin_case.child_id
               );
        elsif child_row.id is not null then
            select * into device_row
              from public.v2_protected_devices device
             where device.child_id = child_row.id
             order by device.registered_at desc
             limit 1;
        end if;

        if device_row.id is not null then
            select * into monitoring_row
              from public.v2_device_monitoring_state state
             where state.device_id = device_row.id;
            select * into health_row
              from public.v2_device_health_events health
             where health.device_id = device_row.id
             order by health.observed_at desc, health.received_at desc
             limit 1;
        end if;

        if child_row.id is not null then
            select * into install_row
              from public.v2_child_install_sessions install
             where install.child_id = child_row.id
             order by install.created_at desc
             limit 1;
        end if;

        monitoring_freshness := case
            when monitoring_row.device_id is null then 'unknown'
            when monitoring_row.monitoring_state = 'revoked'
                then 'not_applicable'
            when monitoring_row.monitoring_state = 'awaiting_first_heartbeat'
                then 'unknown'
            when monitoring_row.interrupted_after_at is not null
                 and now() >= monitoring_row.interrupted_after_at
                then 'interrupted'
            when monitoring_row.late_after_at is not null
                 and now() >= monitoring_row.late_after_at
                then 'late'
            when monitoring_row.monitoring_state = 'interrupted'
                then 'interrupted'
            when monitoring_row.monitoring_state = 'heartbeat_late'
                then 'late'
            else 'fresh'
        end;

        install_freshness := case
            when install_row.id is null then 'unknown'
            when install_row.status = 'expired'
                 or now() >= install_row.expires_at then 'expired'
            else 'fresh'
        end;

        if device_row.id is not null
           and public.v2_admin_has_permission(
               'device.command_lifecycle.read', target_case_id
           ) then
            select coalesce(jsonb_agg(jsonb_build_object(
                'command_id', command.id,
                'command_type', command.command_type,
                'status', case
                    when command.expires_at <= now()
                         and command.status in ('pending', 'claimed')
                        then 'expired'
                    else command.status
                end,
                'not_before', command.not_before,
                'expires_at', command.expires_at,
                'completed_at', command.completed_at,
                'failure_code', command.failure_code,
                'created_at', command.created_at
            ) order by command.created_at desc), '[]'::jsonb)
              into commands_data
              from (
                  select command.*
                    from public.v2_device_commands command
                   where command.device_id = device_row.id
                   order by command.created_at desc
                   limit 10
              ) command;
        end if;

        select jsonb_build_object(
            'registered_count', count(endpoint.id),
            'active_count', count(endpoint.id) filter (
                where endpoint.status = 'active'
            ),
            'denied_count', count(endpoint.id) filter (
                where endpoint.permission_state = 'denied'
            ),
            'last_seen_at', max(endpoint.last_seen_at)
        )
          into push_data
          from public.v2_guardian_memberships membership
          left join public.v2_guardian_push_endpoints endpoint
            on endpoint.guardian_user_id = membership.guardian_user_id
         where membership.family_id = admin_case.family_id
           and membership.status = 'active';

        select coalesce(
                   jsonb_agg(
                       jsonb_build_object(
                           'key', capability.capability_key,
                           'state', case
                               when health_row.capabilities
                                        -> capability.capability_key
                                        ->> 'state' = 'satisfied'
                                   then 'GRANTED'
                               when health_row.capabilities
                                        -> capability.capability_key
                                        ->> 'state' = 'missing'
                                   then 'DENIED'
                               when health_row.capabilities
                                        -> capability.capability_key
                                        ->> 'state' = 'not_applicable'
                                   then 'NOT_SUPPORTED'
                               else 'UNKNOWN'
                           end
                       )
                       order by capability.sort_order
                   ),
                   '[]'::jsonb
               )
          into capabilities_data
          from unnest(array[
              'accessibility_enabled',
              'notification_listener_enabled',
              'app_notifications_allowed',
              'battery_optimization_exempt',
              'oem_autostart_review',
              'usage_access',
              'precise_location',
              'background_location',
              'location_services',
              'package_inventory'
          ]::text[]) with ordinality
            as capability(capability_key, sort_order);

        select coalesce(
                   array_agg(capability_item->>'key' order by sort_order)
                       filter (
                           where capability_item->>'state'
                               in ('DENIED', 'UNKNOWN')
                       ),
                   '{}'::text[]
               )
          into capability_issue_keys
          from jsonb_array_elements(capabilities_data)
               with ordinality as projected(capability_item, sort_order);

        result_data := jsonb_build_object(
            'family', public.v2_admin_field_envelope(
                jsonb_build_object(
                    'family_id', family_row.id,
                    'display_label', 'Family ••••',
                    'status', family_row.status,
                    'guardian_roles', coalesce((
                        select jsonb_agg(jsonb_build_object(
                            'role', membership.role,
                            'status', membership.status
                        ) order by membership.role)
                          from public.v2_guardian_memberships membership
                         where membership.family_id = family_row.id
                    ), '[]'::jsonb)
                ),
                'v2_families+v2_guardian_memberships',
                null, null, family_row.updated_at,
                'fresh', 'confidential', 'masked',
                family_row.updated_at::text, 'EXISTING_V2'
            ),
            'child', public.v2_admin_field_envelope(
                case when child_row.id is null then null else jsonb_build_object(
                    'child_id', child_row.id,
                    'display_label', 'Child ••••',
                    'birth_year', child_row.birth_year,
                    'status', child_row.status
                ) end,
                'v2_children', null, null, child_row.updated_at,
                case when child_row.id is null then 'unknown' else 'fresh' end,
                'confidential', 'masked', child_row.updated_at::text,
                'EXISTING_V2'
            ),
            'install', case
                when public.v2_admin_has_permission(
                    'device.install.read', target_case_id
                ) then public.v2_admin_field_envelope(
                    case when install_row.id is null then null else jsonb_build_object(
                        'install_session_id', install_row.id,
                        'status', case
                            when now() >= install_row.expires_at
                                 and install_row.status in ('created', 'activated')
                                then 'expired'
                            else install_row.status
                        end,
                        'otp_request_count', install_row.otp_request_count,
                        'activated_at', install_row.activated_at,
                        'consumed_at', install_row.consumed_at,
                        'expires_at', install_row.expires_at
                    ) end,
                    'v2_child_install_sessions', null,
                    install_row.updated_at, install_row.updated_at,
                    install_freshness, 'confidential', 'masked',
                    install_row.updated_at::text, 'EXISTING_V2'
                ) else public.v2_admin_field_envelope(
                    null, 'permission_policy', null, null, null,
                    'unknown', 'confidential', 'permission_denied',
                    null, 'REQUIRES_PROJECTION'
                ) end,
            'device', case
                when public.v2_admin_has_permission(
                    'device.health.read', target_case_id
                ) then public.v2_admin_field_envelope(
                    case when device_row.id is null then null else jsonb_build_object(
                        'device_id', device_row.id,
                        'manufacturer', device_row.manufacturer,
                        'model', device_row.model,
                        'app_version', device_row.app_version,
                        'capture_contract_version',
                            device_row.capture_contract_version,
                        'status', device_row.status,
                        'registered_at', device_row.registered_at,
                        'last_seen_at', device_row.last_seen_at,
                        'battery_level_percent',
                            health_row.battery_level_percent
                    ) end,
                    'v2_protected_devices+v2_device_health_events',
                    health_row.observed_at, health_row.received_at,
                    device_row.updated_at, monitoring_freshness,
                    'confidential', 'none',
                    monitoring_row.state_version::text, 'EXISTING_V2'
                ) else public.v2_admin_field_envelope(
                    null, 'permission_policy', null, null, null,
                    'unknown', 'confidential', 'permission_denied',
                    null, 'REQUIRES_PROJECTION'
                ) end,
            'monitoring', case
                when public.v2_admin_has_permission(
                    'device.health.read', target_case_id
                ) then public.v2_admin_field_envelope(
                    case when monitoring_row.device_id is null then null
                         else jsonb_build_object(
                             'state', monitoring_row.monitoring_state,
                             'reason_codes', capability_issue_keys,
                             'last_observed_at', monitoring_row.last_observed_at,
                             'last_received_at', monitoring_row.last_received_at,
                             'late_after_at', monitoring_row.late_after_at,
                             'interrupted_after_at',
                                 monitoring_row.interrupted_after_at,
                             'capture_ready', health_row.capture_ready,
                             'accessibility_enabled',
                                 health_row.accessibility_enabled,
                             'notification_listener_enabled',
                                 health_row.notification_listener_enabled,
                             'battery_optimization_exempt',
                                 health_row.battery_optimization_exempt,
                             'oem_autostart_state',
                                 health_row.oem_autostart_state
                         ) end,
                    'v2_device_monitoring_state+v2_device_health_events',
                    monitoring_row.last_observed_at,
                    monitoring_row.last_received_at,
                    monitoring_row.updated_at, monitoring_freshness,
                    'confidential', 'none',
                    monitoring_row.state_version::text, 'EXISTING_V2'
                ) else public.v2_admin_field_envelope(
                    null, 'permission_policy', null, null, null,
                    'unknown', 'confidential', 'permission_denied',
                    null, 'REQUIRES_PROJECTION'
                ) end,
            'capabilities', case
                when public.v2_admin_has_permission(
                    'device.health.read', target_case_id
                ) then public.v2_admin_field_envelope(
                    capabilities_data,
                    'v2_device_health_events.capabilities.allowlist',
                    health_row.observed_at, health_row.received_at,
                    health_row.received_at, monitoring_freshness,
                    'confidential', 'allowlisted', null, 'EXISTING_V2'
                ) else public.v2_admin_field_envelope(
                    null, 'permission_policy', null, null, null,
                    'unknown', 'confidential', 'permission_denied',
                    null, 'REQUIRES_PROJECTION'
                ) end,
            'commands', public.v2_admin_field_envelope(
                commands_data, 'v2_device_commands', null, null, now(),
                'fresh', 'confidential',
                case when public.v2_admin_has_permission(
                    'device.command_lifecycle.read', target_case_id
                ) then 'payload_hidden' else 'permission_denied' end,
                null, 'EXISTING_V2'
            ),
            'push', public.v2_admin_field_envelope(
                push_data, 'v2_guardian_push_endpoints.aggregate',
                null, case
                    when push_data->>'last_seen_at' is null then null
                    else (push_data->>'last_seen_at')::timestamptz
                end,
                now(), 'fresh', 'confidential', 'secrets_hidden',
                null, 'REQUIRES_PROJECTION'
            ),
            'parental_controls', public.v2_admin_field_envelope(
                null, 'none', null, null, null, 'unknown',
                'restricted', 'not_collected', null,
                'NEW_DOMAIN_REQUIRED'
            )
        );
    end if;

    audit_id := public.v2_admin_write_audit_event(
        'service360.read', 'success', target_case_id, null,
        'service360', target_case_id, 'service360_review',
        array['family', 'child', 'install', 'device', 'monitoring',
              'capabilities', 'commands', 'push'], null, gen_random_uuid(),
        jsonb_build_object('source_mode', admin_case.source_mode)
    );
    return jsonb_build_object(
        'schema_version', 1, 'generated_at', now(),
        'source_mode', admin_case.source_mode, 'data', result_data,
        'page', null, 'audit_event_id', audit_id
    );
end;
$$;

create or replace function public.v2_admin_ingest_whatsapp_webhook_service(
    target_environment text,
    target_channel_mode text,
    target_envelope_sha256 text,
    target_received_at timestamptz,
    target_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    envelope_id uuid;
    existing_envelope record;
    existing_item record;
    item jsonb;
    item_type_value text;
    provider_account_hmac_value text;
    provider_phone_scope_hmac_value text;
    provider_message_hmac_value text;
    contact_id_value uuid;
    channel_identity_id_value uuid;
    conversation_id_value uuid;
    case_id_value uuid;
    message_id_value uuid;
    shadow_job_id_value uuid;
    status_event_id_value uuid;
    provider_occurred_at_value timestamptz;
    accepted_count integer := 0;
    duplicate_count integer := 0;
    rejected_count integer := 0;
    conversation_ids_value uuid[] := '{}'::uuid[];
    case_ids_value uuid[] := '{}'::uuid[];
    shadow_job_ids_value uuid[] := '{}'::uuid[];
begin
    if target_environment = 'production' then
        raise exception 'control_tower_production_not_activated'
            using errcode = '55000';
    end if;
    if target_environment is distinct from 'staging'
       or target_channel_mode is null
       or target_channel_mode not in ('ingest_only', 'shadow', 'live')
       or target_envelope_sha256 is null
       or target_envelope_sha256 !~ '^[0-9a-f]{64}$'
       or target_received_at is null
       or target_items is null
       or jsonb_typeof(target_items) <> 'array'
       or jsonb_array_length(target_items) not between 1 and 100
       or not public.v2_admin_json_is_safe(target_items, 1048576) then
        raise exception 'invalid_channel_envelope' using errcode = '22023';
    end if;

    provider_account_hmac_value :=
        target_items->0->>'provider_account_hmac';
    if provider_account_hmac_value is null
       or provider_account_hmac_value !~ '^[0-9a-f]{64}$' then
        raise exception 'invalid_channel_item' using errcode = '22023';
    end if;

    -- Validate every item before any input-derived row is persisted. Only a
    -- fixed normalized contract is accepted; arbitrary webhook JSON cannot
    -- cross this boundary.
    for item in
        select item_value
          from jsonb_array_elements(target_items) as input(item_value)
    loop
        if jsonb_typeof(item) <> 'object'
           or item->>'provider_account_hmac'
                is distinct from provider_account_hmac_value
           or item->>'item_hmac' is null
           or item->>'item_hmac' !~ '^[0-9a-f]{64}$'
           or item->>'provider_phone_scope_hmac' is null
           or item->>'provider_phone_scope_hmac' !~ '^[0-9a-f]{64}$'
           or item->>'provider_message_hmac' is null
           or item->>'provider_message_hmac' !~ '^[0-9a-f]{64}$' then
            raise exception 'invalid_channel_item' using errcode = '22023';
        end if;

        item_type_value := item->>'item_type';
        if item_type_value is null
           or item_type_value not in ('message', 'status') then
            raise exception 'invalid_channel_item' using errcode = '22023';
        end if;

        begin
            provider_occurred_at_value :=
                (item->>'provider_occurred_at')::timestamptz;
            if provider_occurred_at_value is null then
                raise exception 'invalid_channel_item';
            end if;
        exception
            when others then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
        end;

        if item_type_value = 'message' then
            if exists (
                select 1
                  from jsonb_object_keys(item) as supplied(supplied_key)
                 where supplied.supplied_key not in (
                     'item_type', 'item_hmac', 'provider_account_hmac',
                     'provider_phone_scope_hmac',
                     'provider_message_hmac', 'contact_hmac',
                     'channel_identity_hmac', 'message_type',
                     'provider_occurred_at', 'ciphertext'
                 )
            )
               or item->>'contact_hmac' is null
               or item->>'contact_hmac' !~ '^[0-9a-f]{64}$'
               or item->>'channel_identity_hmac' is null
               or item->>'channel_identity_hmac' !~ '^[0-9a-f]{64}$'
               or item->>'message_type' is null
               or item->>'message_type' not in (
                   'text', 'image', 'video', 'audio', 'voice',
                   'document', 'location', 'contact', 'interactive',
                   'reaction', 'sticker', 'unsupported'
               )
               or not public.v2_admin_valid_ciphertext_envelope(
                   item->'ciphertext'
               ) then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
            end if;
        else
            if exists (
                select 1
                  from jsonb_object_keys(item) as supplied(supplied_key)
                 where supplied.supplied_key not in (
                     'item_type', 'item_hmac', 'provider_account_hmac',
                     'provider_phone_scope_hmac',
                     'provider_message_hmac', 'delivery_status',
                     'provider_occurred_at'
                 )
            )
               or item->>'delivery_status' is null
               or item->>'delivery_status' not in (
                   'provider_accepted', 'delivered', 'read', 'failed'
               ) then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
            end if;
        end if;
    end loop;

    insert into public.v2_support_webhook_envelopes (
        environment,
        channel_mode,
        provider_account_hmac,
        envelope_sha256,
        received_at,
        item_count
    )
    values (
        target_environment,
        target_channel_mode,
        provider_account_hmac_value,
        target_envelope_sha256,
        target_received_at,
        jsonb_array_length(target_items)
    )
    on conflict (
        environment, provider_account_hmac, envelope_sha256
    ) do nothing
    returning id into envelope_id;

    if envelope_id is null then
        select * into existing_envelope
          from public.v2_support_webhook_envelopes envelope
         where envelope.environment = target_environment
           and envelope.provider_account_hmac =
               provider_account_hmac_value
           and envelope.envelope_sha256 = target_envelope_sha256;

        if existing_envelope.processing_status <> 'processed' then
            raise exception 'channel_envelope_incomplete'
                using errcode = '55000';
        end if;

        insert into public.v2_admin_audit_events (
            environment, event_type, outcome, actor_principal_id,
            purpose_code, object_type, object_id, requested_action,
            field_keys, sensitivity, version_snapshot, safe_metadata
        )
        values (
            'staging', 'channel.whatsapp_replayed', 'success',
            'c1000000-0000-4000-8000-000000000002',
            'inbound_channel_ingest', 'webhook_envelope',
            existing_envelope.id, 'channel.ingest',
            array['normalized_hmac', 'ciphertext_envelope'],
            'restricted', '{"contract":"ct-r0-v1"}'::jsonb,
            jsonb_build_object(
                'duplicate_envelope', true,
                'channel_mode', target_channel_mode,
                'item_count', jsonb_array_length(target_items)
            )
        );

        return jsonb_build_object(
            'schema_version', 1,
            'duplicate_envelope', true,
            'accepted_items', existing_envelope.accepted_items,
            'duplicate_items', existing_envelope.duplicate_items,
            'rejected_items', existing_envelope.rejected_items,
            'conversation_ids', existing_envelope.conversation_ids,
            'case_ids', existing_envelope.case_ids,
            'shadow_job_ids', existing_envelope.shadow_job_ids
        );
    end if;

    for item in
        select item_value
          from jsonb_array_elements(target_items) as input(item_value)
    loop
        item_type_value := item->>'item_type';
        provider_phone_scope_hmac_value :=
            item->>'provider_phone_scope_hmac';
        provider_message_hmac_value :=
            item->>'provider_message_hmac';
        provider_occurred_at_value :=
            (item->>'provider_occurred_at')::timestamptz;
        conversation_id_value := null;
        case_id_value := null;
        message_id_value := null;
        shadow_job_id_value := null;

        select webhook_item.* into existing_item
          from public.v2_support_webhook_items webhook_item
         where webhook_item.environment = target_environment
           and webhook_item.provider_account_hmac =
               provider_account_hmac_value
           and webhook_item.item_hmac = item->>'item_hmac';

        if found then
            duplicate_count := duplicate_count + 1;
            conversation_id_value := existing_item.conversation_id;
            case_id_value := existing_item.case_id;
            shadow_job_id_value := existing_item.shadow_job_id;
            if conversation_id_value is not null
               and not conversation_id_value = any(
                   conversation_ids_value
               ) then
                conversation_ids_value := array_append(
                    conversation_ids_value, conversation_id_value
                );
            end if;
            if case_id_value is not null
               and not case_id_value = any(case_ids_value) then
                case_ids_value := array_append(
                    case_ids_value, case_id_value
                );
            end if;
            if shadow_job_id_value is not null
               and not shadow_job_id_value = any(
                   shadow_job_ids_value
               ) then
                shadow_job_ids_value := array_append(
                    shadow_job_ids_value, shadow_job_id_value
                );
            end if;
            continue;
        end if;

        select message.id, message.conversation_id
          into message_id_value, conversation_id_value
          from public.v2_support_messages message
         where message.environment = target_environment
           and message.provider_account_hmac =
               provider_account_hmac_value
           and message.provider_phone_scope_hmac =
               provider_phone_scope_hmac_value
           and message.provider_message_hmac =
               provider_message_hmac_value;

        if item_type_value = 'message'
           and message_id_value is not null then
            select link.case_id into case_id_value
              from public.v2_admin_case_conversations link
             where link.conversation_id = conversation_id_value
             order by link.is_primary desc, link.linked_at
             limit 1;
            select job.id into shadow_job_id_value
              from public.v2_admin_shadow_jobs job
             where job.message_id = message_id_value
             order by job.created_at, job.id
             limit 1;

            insert into public.v2_support_webhook_items (
                envelope_id, environment, provider_account_hmac,
                item_hmac, item_type, accepted, conversation_id,
                case_id, message_id, shadow_job_id
            )
            values (
                envelope_id, target_environment,
                provider_account_hmac_value, item->>'item_hmac',
                item_type_value, true, conversation_id_value,
                case_id_value, message_id_value, shadow_job_id_value
            );
            duplicate_count := duplicate_count + 1;
        elsif item_type_value = 'message' then
            insert into public.v2_support_contacts (
                environment, contact_kind, contact_hash,
                display_label_redacted
            )
            values (
                target_environment, 'unknown', item->>'contact_hmac',
                'WhatsApp contact (redacted)'
            )
            on conflict (environment, contact_hash) do nothing
            returning id into contact_id_value;

            if contact_id_value is null then
                select contact.id into contact_id_value
                  from public.v2_support_contacts contact
                 where contact.environment = target_environment
                   and contact.contact_hash = item->>'contact_hmac';
            end if;

            insert into public.v2_support_channel_identities (
                environment, contact_id, channel, provider_account_key,
                provider_identity_hash, display_identity_redacted
            )
            values (
                target_environment, contact_id_value, 'whatsapp',
                provider_account_hmac_value,
                item->>'channel_identity_hmac',
                'WhatsApp identity (redacted)'
            )
            on conflict (
                environment, channel, provider_account_key,
                provider_identity_hash
            ) do nothing
            returning id into channel_identity_id_value;

            if channel_identity_id_value is null then
                select identity.id into channel_identity_id_value
                  from public.v2_support_channel_identities identity
                 where identity.environment = target_environment
                   and identity.channel = 'whatsapp'
                   and identity.provider_account_key =
                       provider_account_hmac_value
                   and identity.provider_identity_hash =
                       item->>'channel_identity_hmac';
            end if;

            insert into public.v2_support_conversations (
                environment, source_mode, channel_identity_id, channel,
                status, verification_level, last_activity_at
            )
            values (
                target_environment, 'staging', channel_identity_id_value,
                'whatsapp', 'open', 'v0_unknown', target_received_at
            )
            on conflict (environment, channel_identity_id)
                where channel = 'whatsapp'
                  and status not in ('resolved', 'closed')
            do update set
                last_activity_at = greatest(
                    public.v2_support_conversations.last_activity_at,
                    excluded.last_activity_at
                )
            returning id into conversation_id_value;

            perform 1
              from public.v2_support_conversations conversation
             where conversation.id = conversation_id_value
             for update;

            select admin_case.id into case_id_value
              from public.v2_admin_case_conversations link
              join public.v2_admin_cases admin_case
                on admin_case.id = link.case_id
             where link.conversation_id = conversation_id_value
               and admin_case.status not in ('resolved', 'closed')
             order by link.is_primary desc, admin_case.created_at
             limit 1;

            if case_id_value is null then
                insert into public.v2_admin_cases (
                    environment, source_mode, domain_key, category_key,
                    intent_key, priority, status, queue_key, purpose_code,
                    sensitivity, privacy_class, verification_level,
                    last_activity_at
                )
                values (
                    target_environment, 'staging', 'support',
                    'customer_support', 'new_inbound', 's2', 'open',
                    'customer_support', 'inbound_support',
                    'confidential', 'support_contact', 'v0_unknown',
                    target_received_at
                )
                returning id into case_id_value;

                insert into public.v2_admin_case_conversations (
                    case_id, conversation_id, is_primary
                )
                values (case_id_value, conversation_id_value, true);

                insert into public.v2_admin_case_events (
                    case_id, event_type, new_status,
                    actor_principal_id, reason_code, safe_metadata,
                    occurred_at
                )
                values (
                    case_id_value, 'case.created_from_inbound', 'open',
                    'c1000000-0000-4000-8000-000000000002',
                    'new_inbound',
                    jsonb_build_object('channel', 'whatsapp'),
                    target_received_at
                );
            else
                update public.v2_admin_cases
                   set last_activity_at = greatest(
                       last_activity_at, target_received_at
                   )
                 where id = case_id_value;
            end if;

            insert into public.v2_support_messages (
                environment, conversation_id, provider_account_hmac,
                provider_phone_scope_hmac, provider_message_hmac,
                direction, message_type, ingest_status, delivery_status,
                provider_occurred_at, server_received_at,
                retention_class, sensitivity
            )
            values (
                target_environment, conversation_id_value,
                provider_account_hmac_value,
                provider_phone_scope_hmac_value,
                provider_message_hmac_value, 'inbound',
                item->>'message_type', 'persisted', 'not_applicable',
                provider_occurred_at_value, target_received_at,
                'support_standard', 'confidential'
            )
            returning id into message_id_value;

            insert into public.v2_support_protected_content (
                message_id, algorithm, key_ref, nonce_b64,
                ciphertext_b64, aad_sha256
            )
            values (
                message_id_value,
                item->'ciphertext'->>'algorithm',
                item->'ciphertext'->>'key_ref',
                item->'ciphertext'->>'nonce_b64',
                item->'ciphertext'->>'ciphertext_b64',
                item->'ciphertext'->>'aad_sha256'
            );

            if target_channel_mode in ('shadow', 'live') then
                insert into public.v2_admin_shadow_jobs (
                    environment, channel_mode, message_id, case_id
                )
                values (
                    target_environment, target_channel_mode,
                    message_id_value, case_id_value
                )
                returning id into shadow_job_id_value;
            end if;

            insert into public.v2_support_webhook_items (
                envelope_id, environment, provider_account_hmac,
                item_hmac, item_type, accepted, conversation_id,
                case_id, message_id, shadow_job_id
            )
            values (
                envelope_id, target_environment,
                provider_account_hmac_value, item->>'item_hmac',
                item_type_value, true, conversation_id_value,
                case_id_value, message_id_value, shadow_job_id_value
            );
            accepted_count := accepted_count + 1;
        elsif message_id_value is null then
            insert into public.v2_support_webhook_items (
                envelope_id, environment, provider_account_hmac,
                item_hmac, item_type, accepted, rejection_code
            )
            values (
                envelope_id, target_environment,
                provider_account_hmac_value, item->>'item_hmac',
                item_type_value, false, 'unknown_message'
            );
            rejected_count := rejected_count + 1;
        else
            select link.case_id into case_id_value
              from public.v2_admin_case_conversations link
             where link.conversation_id = conversation_id_value
             order by link.is_primary desc, link.linked_at
             limit 1;

            status_event_id_value := null;
            insert into public.v2_support_message_status_events (
                environment, provider_account_hmac, message_id,
                event_hmac, delivery_status, provider_occurred_at,
                received_at
            )
            values (
                target_environment, provider_account_hmac_value,
                message_id_value, item->>'item_hmac',
                item->>'delivery_status', provider_occurred_at_value,
                target_received_at
            )
            on conflict (
                environment, provider_account_hmac, event_hmac
            ) do nothing
            returning id into status_event_id_value;

            if status_event_id_value is null then
                duplicate_count := duplicate_count + 1;
            else
                update public.v2_support_messages message
                   set delivery_status = case
                       when item->>'delivery_status' = 'read' then 'read'
                       when item->>'delivery_status' = 'delivered'
                            and message.delivery_status <> 'read'
                           then 'delivered'
                       when item->>'delivery_status' = 'provider_accepted'
                            and message.delivery_status = 'not_applicable'
                           then 'provider_accepted'
                       when item->>'delivery_status' = 'failed'
                            and message.delivery_status in (
                                'not_applicable', 'provider_accepted'
                            )
                           then 'failed'
                       else message.delivery_status
                   end
                 where message.id = message_id_value;
                accepted_count := accepted_count + 1;
            end if;

            insert into public.v2_support_webhook_items (
                envelope_id, environment, provider_account_hmac,
                item_hmac, item_type, accepted, conversation_id,
                case_id, message_id
            )
            values (
                envelope_id, target_environment,
                provider_account_hmac_value, item->>'item_hmac',
                item_type_value, true, conversation_id_value,
                case_id_value, message_id_value
            );
        end if;

        if conversation_id_value is not null
           and not conversation_id_value = any(
               conversation_ids_value
           ) then
            conversation_ids_value := array_append(
                conversation_ids_value, conversation_id_value
            );
        end if;
        if case_id_value is not null
           and not case_id_value = any(case_ids_value) then
            case_ids_value := array_append(case_ids_value, case_id_value);
        end if;
        if shadow_job_id_value is not null
           and not shadow_job_id_value = any(shadow_job_ids_value) then
            shadow_job_ids_value := array_append(
                shadow_job_ids_value, shadow_job_id_value
            );
        end if;
    end loop;

    select coalesce(array_agg(distinct value order by value), '{}'::uuid[])
      into conversation_ids_value
      from unnest(conversation_ids_value) as ids(value);
    select coalesce(array_agg(distinct value order by value), '{}'::uuid[])
      into case_ids_value
      from unnest(case_ids_value) as ids(value);
    select coalesce(array_agg(distinct value order by value), '{}'::uuid[])
      into shadow_job_ids_value
      from unnest(shadow_job_ids_value) as ids(value);

    update public.v2_support_webhook_envelopes
       set processing_status = 'processed',
           accepted_items = accepted_count,
           duplicate_items = duplicate_count,
           rejected_items = rejected_count,
           conversation_ids = conversation_ids_value,
           case_ids = case_ids_value,
           shadow_job_ids = shadow_job_ids_value,
           processed_at = now()
     where id = envelope_id;

    insert into public.v2_admin_audit_events (
        environment, event_type, outcome, actor_principal_id,
        purpose_code, object_type, object_id, requested_action,
        field_keys, sensitivity, version_snapshot, safe_metadata
    )
    values (
        'staging', 'channel.whatsapp_ingested', 'success',
        'c1000000-0000-4000-8000-000000000002',
        'inbound_channel_ingest', 'webhook_envelope', envelope_id,
        'channel.ingest',
        array['normalized_hmac', 'ciphertext_envelope'],
        'restricted', '{"contract":"ct-r0-v1"}'::jsonb,
        jsonb_build_object(
            'duplicate_envelope', false,
            'channel_mode', target_channel_mode,
            'accepted_items', accepted_count,
            'duplicate_items', duplicate_count,
            'rejected_items', rejected_count
        )
    );

    return jsonb_build_object(
        'schema_version', 1,
        'duplicate_envelope', false,
        'accepted_items', accepted_count,
        'duplicate_items', duplicate_count,
        'rejected_items', rejected_count,
        'conversation_ids', conversation_ids_value,
        'case_ids', case_ids_value,
        'shadow_job_ids', shadow_job_ids_value
    );
end;
$$;

create or replace function public.v2_admin_valid_crypto_key_ids(
    target_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    key_name text;
    key_value numeric;
begin
    if target_value is null or jsonb_typeof(target_value) <> 'object'
       or exists (
           select 1
             from jsonb_object_keys(target_value) as supplied(key_name)
            where supplied.key_name not in (
                'content_encryption', 'contact_lookup_hmac',
                'provider_id_hmac', 'content_digest_hmac'
            )
       ) then
        return false;
    end if;

    foreach key_name in array array[
        'content_encryption', 'contact_lookup_hmac',
        'provider_id_hmac', 'content_digest_hmac'
    ]
    loop
        if jsonb_typeof(target_value->key_name)
                is distinct from 'number' then
            return false;
        end if;
        begin
            key_value := (target_value->>key_name)::numeric;
        exception
            when others then return false;
        end;
        if key_value <> trunc(key_value)
           or key_value not between 1 and 2147483647 then
            return false;
        end if;
    end loop;
    return true;
end;
$$;

-- Final SQL-facing WhatsApp contract. Items are schema version 2 and contain
-- only keyed lookup digests plus an AES-GCM ciphertext envelope. Raw provider
-- identifiers, raw AAD, message content, provider payloads, and secrets are
-- rejected before any input-derived row is written.
create or replace function public.v2_admin_ingest_whatsapp_webhook_service(
    target_environment text,
    target_channel_mode text,
    target_envelope_sha256 text,
    target_received_at timestamptz,
    target_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    envelope_id uuid;
    existing_envelope record;
    existing_item record;
    item jsonb;
    item_kind text;
    item_hmac_value text;
    provider_account_hmac_value text;
    provider_phone_scope_hmac_value text;
    provider_message_hmac_value text;
    provider_occurred_at_value timestamptz;
    item_received_at_value timestamptz;
    contact_id_value uuid;
    channel_identity_id_value uuid;
    conversation_id_value uuid;
    case_id_value uuid;
    message_id_value uuid;
    reply_to_message_id_value uuid;
    shadow_job_id_value uuid;
    status_event_id_value uuid;
    accepted_count integer := 0;
    duplicate_count integer := 0;
    rejected_count integer := 0;
    conversation_ids_value uuid[] := '{}'::uuid[];
    case_ids_value uuid[] := '{}'::uuid[];
    shadow_job_ids_value uuid[] := '{}'::uuid[];
begin
    if target_environment = 'production' then
        raise exception 'control_tower_production_not_activated'
            using errcode = '55000';
    end if;
    if target_environment is distinct from 'staging'
       or target_channel_mode is null
       or target_channel_mode not in ('ingest_only', 'shadow', 'live')
       or target_envelope_sha256 is null
       or target_envelope_sha256 !~ '^[0-9a-f]{64}$'
       or target_received_at is null
       or target_items is null
       or jsonb_typeof(target_items) <> 'array'
       or jsonb_array_length(target_items) not between 0 and 1000 then
        raise exception 'invalid_channel_envelope' using errcode = '22023';
    end if;
    if not public.v2_admin_json_is_safe(target_items, 16777216) then
        raise exception 'invalid_channel_item' using errcode = '22023';
    end if;

    for item in
        select input.item_value
          from jsonb_array_elements(target_items) as input(item_value)
    loop
        item_kind := item->>'kind';
        if jsonb_typeof(item) is distinct from 'object'
           or item->'schema_version' is distinct from '2'::jsonb
           or item->>'provider' is distinct from 'whatsapp_cloud'
           or item_kind is null
           or item_kind not in ('message', 'status', 'provider_error')
           or item->>'idempotency_hmac' is null
           or item->>'idempotency_hmac' !~ '^[0-9a-f]{64}$'
           or item->>'waba_lookup_hmac' is null
           or item->>'waba_lookup_hmac' !~ '^[0-9a-f]{64}$'
           or item->>'phone_number_lookup_hmac' is null
           or item->>'phone_number_lookup_hmac' !~ '^[0-9a-f]{64}$'
           or item->>'content_digest_hmac' is null
           or item->>'content_digest_hmac' !~ '^[0-9a-f]{64}$'
           or not public.v2_admin_valid_crypto_key_ids(
               item->'crypto_key_ids'
           )
           or not public.v2_admin_valid_ciphertext_envelope(
               item->'content_envelope'
           ) then
            raise exception 'invalid_channel_item' using errcode = '22023';
        end if;

        begin
            provider_occurred_at_value :=
                (item->>'provider_timestamp')::timestamptz;
            item_received_at_value := (item->>'received_at')::timestamptz;
            if provider_occurred_at_value is null
               or item_received_at_value is distinct from target_received_at
               or octet_length(decode(
                   item->'content_envelope'->>'nonce_base64', 'base64'
               )) <> 12
               or octet_length(decode(
                   item->'content_envelope'->>'ciphertext_base64', 'base64'
               )) not between 16 and 65552 then
                raise exception 'invalid_channel_item';
            end if;
        exception
            when others then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
        end;

        if provider_account_hmac_value is null then
            provider_account_hmac_value := item->>'waba_lookup_hmac';
            provider_phone_scope_hmac_value :=
                item->>'phone_number_lookup_hmac';
        elsif provider_account_hmac_value
                is distinct from item->>'waba_lookup_hmac'
           or provider_phone_scope_hmac_value
                is distinct from item->>'phone_number_lookup_hmac' then
            raise exception 'mixed_channel_accounts' using errcode = '22023';
        end if;

        if item_kind = 'message' then
            if exists (
                select 1
                  from jsonb_object_keys(item) as supplied(key_name)
                 where supplied.key_name not in (
                     'schema_version', 'provider', 'kind',
                     'idempotency_hmac', 'waba_lookup_hmac',
                     'phone_number_lookup_hmac', 'provider_timestamp',
                     'received_at', 'content_digest_hmac',
                     'crypto_key_ids', 'content_envelope',
                     'provider_message_id_hmac', 'message_type',
                     'sender_lookup_hmac',
                     'reply_to_provider_message_id_hmac', 'media'
                 )
            )
               or item->>'provider_message_id_hmac' is null
               or item->>'provider_message_id_hmac'
                    !~ '^[0-9a-f]{64}$'
               or item->>'sender_lookup_hmac' is null
               or item->>'sender_lookup_hmac' !~ '^[0-9a-f]{64}$'
               or item->>'message_type' is null
               or item->>'message_type' not in (
                   'text', 'image', 'video', 'audio', 'voice',
                   'document', 'sticker', 'interactive', 'button',
                   'contacts', 'location', 'reaction', 'order',
                   'system', 'unsupported'
               )
               or (
                   item ? 'reply_to_provider_message_id_hmac'
                   and (
                       item->>'reply_to_provider_message_id_hmac' is null
                       or item->>'reply_to_provider_message_id_hmac'
                            !~ '^[0-9a-f]{64}$'
                   )
               ) then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
            end if;

            if item ? 'media' and (
                jsonb_typeof(item->'media') <> 'object'
                or exists (
                    select 1
                      from jsonb_object_keys(item->'media')
                           as media_key(key_name)
                     where media_key.key_name not in (
                         'provider_media_id_hmac', 'mime_type',
                         'provider_sha256', 'scan_state'
                     )
                )
                or item#>>'{media,provider_media_id_hmac}' is null
                or item#>>'{media,provider_media_id_hmac}'
                    !~ '^[0-9a-f]{64}$'
                or item#>>'{media,scan_state}' is distinct from 'quarantined'
                or (
                    item->'media' ? 'mime_type'
                    and (
                        item#>>'{media,mime_type}' is null
                        or char_length(item#>>'{media,mime_type}')
                            not between 1 and 255
                        or item#>>'{media,mime_type}' ~ '[[:cntrl:]]'
                    )
                )
                or (
                    item->'media' ? 'provider_sha256'
                    and (
                        item#>>'{media,provider_sha256}' is null
                        or item#>>'{media,provider_sha256}'
                            !~ '^[A-Za-z0-9+/=_-]{1,128}$'
                    )
                )
            ) then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
            end if;
        elsif item_kind = 'status' then
            if exists (
                select 1
                  from jsonb_object_keys(item) as supplied(key_name)
                 where supplied.key_name not in (
                     'schema_version', 'provider', 'kind',
                     'idempotency_hmac', 'waba_lookup_hmac',
                     'phone_number_lookup_hmac', 'provider_timestamp',
                     'received_at', 'content_digest_hmac',
                     'crypto_key_ids', 'content_envelope',
                     'provider_message_id_hmac',
                     'recipient_lookup_hmac', 'status', 'error_code',
                     'error_fingerprint_hmac'
                 )
            )
               or item->>'provider_message_id_hmac' is null
               or item->>'provider_message_id_hmac'
                    !~ '^[0-9a-f]{64}$'
               or item->>'recipient_lookup_hmac' is null
               or item->>'recipient_lookup_hmac' !~ '^[0-9a-f]{64}$'
               or item->>'status' is null
               or item->>'status' not in (
                   'sent', 'delivered', 'read', 'failed',
                   'deleted', 'unknown'
               )
               or (
                   item ? 'error_code'
                   and (
                       item->>'error_code' is null
                       or item->>'error_code'
                           !~ '^[A-Za-z0-9_.:-]{1,64}$'
                   )
               )
               or (
                   item ? 'error_fingerprint_hmac'
                   and (
                       item->>'error_fingerprint_hmac' is null
                       or item->>'error_fingerprint_hmac'
                           !~ '^[0-9a-f]{64}$'
                   )
               ) then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
            end if;
        else
            if exists (
                select 1
                  from jsonb_object_keys(item) as supplied(key_name)
                 where supplied.key_name not in (
                     'schema_version', 'provider', 'kind',
                     'idempotency_hmac', 'waba_lookup_hmac',
                     'phone_number_lookup_hmac', 'provider_timestamp',
                     'received_at', 'content_digest_hmac',
                     'crypto_key_ids', 'content_envelope', 'error_code'
                 )
            )
               or (
                   item ? 'error_code'
                   and (
                       item->>'error_code' is null
                       or item->>'error_code'
                           !~ '^[A-Za-z0-9_.:-]{1,64}$'
                   )
               ) then
                raise exception 'invalid_channel_item'
                    using errcode = '22023';
            end if;
        end if;
    end loop;

    if provider_account_hmac_value is null then
        provider_account_hmac_value := repeat('0', 64);
        provider_phone_scope_hmac_value := repeat('0', 64);
    end if;

    insert into public.v2_support_webhook_envelopes (
        environment, channel_mode, provider_account_hmac,
        envelope_sha256, received_at, item_count
    )
    values (
        target_environment, target_channel_mode,
        provider_account_hmac_value, target_envelope_sha256,
        target_received_at, jsonb_array_length(target_items)
    )
    on conflict (
        environment, provider_account_hmac, envelope_sha256
    ) do nothing
    returning id into envelope_id;

    if envelope_id is null then
        select * into existing_envelope
          from public.v2_support_webhook_envelopes envelope
         where envelope.environment = target_environment
           and envelope.provider_account_hmac =
               provider_account_hmac_value
           and envelope.envelope_sha256 = target_envelope_sha256;

        if existing_envelope.processing_status <> 'processed'
           or existing_envelope.channel_mode <> target_channel_mode then
            raise exception 'channel_envelope_conflict'
                using errcode = '55000';
        end if;

        insert into public.v2_admin_audit_events (
            environment, event_type, outcome, actor_principal_id,
            purpose_code, object_type, object_id, requested_action,
            field_keys, sensitivity, version_snapshot, safe_metadata
        )
        values (
            'staging', 'channel.whatsapp_replayed', 'success',
            'c1000000-0000-4000-8000-000000000002',
            'inbound_channel_ingest', 'webhook_envelope',
            existing_envelope.id, 'channel.ingest',
            array['lookup_hmac', 'ciphertext_envelope'],
            'restricted', '{"contract":"ct-r0-v1"}'::jsonb,
            jsonb_build_object(
                'duplicate_envelope', true,
                'channel_mode', target_channel_mode,
                'item_count', jsonb_array_length(target_items)
            )
        );

        return jsonb_build_object(
            'schema_version', 1,
            'duplicate_envelope', true,
            'accepted_items', existing_envelope.accepted_items,
            'duplicate_items', existing_envelope.duplicate_items,
            'rejected_items', existing_envelope.rejected_items,
            'conversation_ids', existing_envelope.conversation_ids,
            'case_ids', existing_envelope.case_ids,
            'shadow_job_ids', existing_envelope.shadow_job_ids
        );
    end if;

    for item in
        select input.item_value
          from jsonb_array_elements(target_items) as input(item_value)
         order by coalesce(
             input.item_value->>'provider_message_id_hmac',
             input.item_value->>'idempotency_hmac'
         ), input.item_value->>'idempotency_hmac'
    loop
        item_kind := item->>'kind';
        item_hmac_value := item->>'idempotency_hmac';
        provider_message_hmac_value :=
            item->>'provider_message_id_hmac';
        provider_occurred_at_value :=
            (item->>'provider_timestamp')::timestamptz;
        contact_id_value := null;
        channel_identity_id_value := null;
        conversation_id_value := null;
        case_id_value := null;
        message_id_value := null;
        reply_to_message_id_value := null;
        shadow_job_id_value := null;

        perform pg_advisory_xact_lock(hashtextextended(
            target_environment || ':' || provider_account_hmac_value || ':'
            || coalesce(provider_message_hmac_value, item_hmac_value),
            0
        ));

        select webhook_item.* into existing_item
          from public.v2_support_webhook_items webhook_item
         where webhook_item.environment = target_environment
           and webhook_item.provider_account_hmac =
               provider_account_hmac_value
           and webhook_item.item_hmac = item_hmac_value;

        if found then
            duplicate_count := duplicate_count + 1;
            conversation_id_value := existing_item.conversation_id;
            case_id_value := existing_item.case_id;
            shadow_job_id_value := existing_item.shadow_job_id;
        elsif item_kind = 'provider_error' then
            insert into public.v2_support_webhook_items (
                envelope_id, environment, provider_account_hmac,
                item_hmac, item_type, safe_error_code, accepted
            )
            values (
                envelope_id, target_environment,
                provider_account_hmac_value, item_hmac_value,
                item_kind, item->>'error_code', true
            );

            insert into public.v2_support_protected_content (
                environment, provider_account_hmac, item_hmac,
                content_kind, content_digest_hmac,
                content_encryption_key_id,
                contact_lookup_hmac_key_id,
                provider_id_hmac_key_id,
                content_digest_hmac_key_id,
                message_id, algorithm, key_ref, nonce_b64,
                ciphertext_b64, aad_sha256
            )
            values (
                target_environment, provider_account_hmac_value,
                item_hmac_value, item_kind,
                item->>'content_digest_hmac',
                (item#>>'{crypto_key_ids,content_encryption}')::integer,
                (item#>>'{crypto_key_ids,contact_lookup_hmac}')::integer,
                (item#>>'{crypto_key_ids,provider_id_hmac}')::integer,
                (item#>>'{crypto_key_ids,content_digest_hmac}')::integer,
                null, 'aes256gcm',
                'whatsapp.content.' ||
                    (item#>>'{crypto_key_ids,content_encryption}'),
                item#>>'{content_envelope,nonce_base64}',
                item#>>'{content_envelope,ciphertext_base64}',
                item#>>'{content_envelope,aad_sha256}'
            );
            accepted_count := accepted_count + 1;
        else
            select message.id, message.conversation_id
              into message_id_value, conversation_id_value
              from public.v2_support_messages message
             where message.environment = target_environment
               and message.provider_account_hmac =
                   provider_account_hmac_value
               and message.provider_phone_scope_hmac =
                   provider_phone_scope_hmac_value
               and message.provider_message_hmac =
                   provider_message_hmac_value;

            if item_kind = 'message' and message_id_value is not null then
                select link.case_id into case_id_value
                  from public.v2_admin_case_conversations link
                 where link.conversation_id = conversation_id_value
                 order by link.is_primary desc, link.linked_at
                 limit 1;
                select job.id into shadow_job_id_value
                  from public.v2_admin_shadow_jobs job
                 where job.message_id = message_id_value
                 order by job.created_at, job.id
                 limit 1;

                insert into public.v2_support_webhook_items (
                    envelope_id, environment, provider_account_hmac,
                    item_hmac, item_type, accepted, conversation_id,
                    case_id, message_id, shadow_job_id
                )
                values (
                    envelope_id, target_environment,
                    provider_account_hmac_value, item_hmac_value,
                    item_kind, true, conversation_id_value,
                    case_id_value, message_id_value, shadow_job_id_value
                );
                duplicate_count := duplicate_count + 1;
            elsif item_kind = 'message' then
                insert into public.v2_support_contacts (
                    environment, contact_kind, contact_hash,
                    display_label_redacted
                )
                values (
                    target_environment, 'unknown',
                    item->>'sender_lookup_hmac',
                    'WhatsApp contact (redacted)'
                )
                on conflict (environment, contact_hash) do nothing
                returning id into contact_id_value;

                if contact_id_value is null then
                    select contact.id into contact_id_value
                      from public.v2_support_contacts contact
                     where contact.environment = target_environment
                       and contact.contact_hash =
                           item->>'sender_lookup_hmac';
                end if;

                insert into public.v2_support_channel_identities (
                    environment, contact_id, channel,
                    provider_account_key, provider_identity_hash,
                    display_identity_redacted
                )
                values (
                    target_environment, contact_id_value, 'whatsapp',
                    provider_account_hmac_value,
                    item->>'sender_lookup_hmac',
                    'WhatsApp identity (redacted)'
                )
                on conflict (
                    environment, channel, provider_account_key,
                    provider_identity_hash
                ) do nothing
                returning id into channel_identity_id_value;

                if channel_identity_id_value is null then
                    select identity.id into channel_identity_id_value
                      from public.v2_support_channel_identities identity
                     where identity.environment = target_environment
                       and identity.channel = 'whatsapp'
                       and identity.provider_account_key =
                           provider_account_hmac_value
                       and identity.provider_identity_hash =
                           item->>'sender_lookup_hmac';
                end if;

                insert into public.v2_support_conversations (
                    environment, source_mode, channel_identity_id,
                    channel, status, verification_level,
                    last_activity_at
                )
                values (
                    target_environment, 'staging',
                    channel_identity_id_value, 'whatsapp', 'open',
                    'v0_unknown', target_received_at
                )
                on conflict (environment, channel_identity_id)
                    where channel = 'whatsapp'
                      and status not in ('resolved', 'closed')
                do update set
                    last_activity_at = greatest(
                        public.v2_support_conversations.last_activity_at,
                        excluded.last_activity_at
                    )
                returning id into conversation_id_value;

                perform 1
                  from public.v2_support_conversations conversation
                 where conversation.id = conversation_id_value
                 for update;

                select admin_case.id into case_id_value
                  from public.v2_admin_case_conversations link
                  join public.v2_admin_cases admin_case
                    on admin_case.id = link.case_id
                 where link.conversation_id = conversation_id_value
                   and admin_case.status not in ('resolved', 'closed')
                 order by link.is_primary desc, admin_case.created_at
                 limit 1;

                if case_id_value is null then
                    insert into public.v2_admin_cases (
                        environment, source_mode, domain_key,
                        category_key, intent_key, priority, status,
                        queue_key, purpose_code, sensitivity,
                        privacy_class, verification_level,
                        last_activity_at
                    )
                    values (
                        target_environment, 'staging', 'support',
                        'customer_support', 'new_inbound', 's2', 'open',
                        'customer_support', 'inbound_support',
                        'confidential', 'support_contact', 'v0_unknown',
                        target_received_at
                    )
                    returning id into case_id_value;

                    insert into public.v2_admin_case_conversations (
                        case_id, conversation_id, is_primary
                    )
                    values (case_id_value, conversation_id_value, true);

                    insert into public.v2_admin_case_events (
                        case_id, event_type, new_status,
                        actor_principal_id, reason_code, safe_metadata,
                        occurred_at
                    )
                    values (
                        case_id_value, 'case.created_from_inbound', 'open',
                        'c1000000-0000-4000-8000-000000000002',
                        'new_inbound',
                        jsonb_build_object('channel', 'whatsapp'),
                        target_received_at
                    );
                else
                    update public.v2_admin_cases
                       set last_activity_at = greatest(
                           last_activity_at, target_received_at
                       )
                     where id = case_id_value;
                end if;

                if item ? 'reply_to_provider_message_id_hmac' then
                    select reply.id into reply_to_message_id_value
                      from public.v2_support_messages reply
                     where reply.environment = target_environment
                       and reply.provider_account_hmac =
                           provider_account_hmac_value
                       and reply.provider_phone_scope_hmac =
                           provider_phone_scope_hmac_value
                       and reply.provider_message_hmac =
                           item->>'reply_to_provider_message_id_hmac';
                end if;

                insert into public.v2_support_messages (
                    environment, conversation_id,
                    provider_account_hmac, provider_phone_scope_hmac,
                    provider_message_hmac, direction, message_type,
                    ingest_status, delivery_status,
                    provider_media_hmac, media_mime_type,
                    media_provider_sha256, media_scan_state,
                    reply_to_message_id, provider_occurred_at,
                    server_received_at, retention_class, sensitivity
                )
                values (
                    target_environment, conversation_id_value,
                    provider_account_hmac_value,
                    provider_phone_scope_hmac_value,
                    provider_message_hmac_value, 'inbound',
                    item->>'message_type', 'persisted',
                    'not_applicable',
                    item#>>'{media,provider_media_id_hmac}',
                    item#>>'{media,mime_type}',
                    item#>>'{media,provider_sha256}',
                    item#>>'{media,scan_state}',
                    reply_to_message_id_value,
                    provider_occurred_at_value, target_received_at,
                    'support_standard', 'confidential'
                )
                returning id into message_id_value;

                if target_channel_mode = 'shadow' then
                    insert into public.v2_admin_shadow_jobs (
                        environment, channel_mode, message_id, case_id
                    )
                    values (
                        target_environment, target_channel_mode,
                        message_id_value, case_id_value
                    )
                    returning id into shadow_job_id_value;
                end if;

                insert into public.v2_support_webhook_items (
                    envelope_id, environment, provider_account_hmac,
                    item_hmac, item_type, accepted, conversation_id,
                    case_id, message_id, shadow_job_id
                )
                values (
                    envelope_id, target_environment,
                    provider_account_hmac_value, item_hmac_value,
                    item_kind, true, conversation_id_value,
                    case_id_value, message_id_value,
                    shadow_job_id_value
                );

                insert into public.v2_support_protected_content (
                    environment, provider_account_hmac, item_hmac,
                    content_kind, content_digest_hmac,
                    content_encryption_key_id,
                    contact_lookup_hmac_key_id,
                    provider_id_hmac_key_id,
                    content_digest_hmac_key_id,
                    message_id, algorithm, key_ref, nonce_b64,
                    ciphertext_b64, aad_sha256
                )
                values (
                    target_environment, provider_account_hmac_value,
                    item_hmac_value, item_kind,
                    item->>'content_digest_hmac',
                    (item#>>'{crypto_key_ids,content_encryption}')::integer,
                    (item#>>'{crypto_key_ids,contact_lookup_hmac}')::integer,
                    (item#>>'{crypto_key_ids,provider_id_hmac}')::integer,
                    (item#>>'{crypto_key_ids,content_digest_hmac}')::integer,
                    message_id_value, 'aes256gcm',
                    'whatsapp.content.' ||
                        (item#>>'{crypto_key_ids,content_encryption}'),
                    item#>>'{content_envelope,nonce_base64}',
                    item#>>'{content_envelope,ciphertext_base64}',
                    item#>>'{content_envelope,aad_sha256}'
                );
                accepted_count := accepted_count + 1;
            elsif message_id_value is null then
                insert into public.v2_support_webhook_items (
                    envelope_id, environment, provider_account_hmac,
                    item_hmac, item_type, safe_error_code,
                    error_fingerprint_hmac, accepted, rejection_code
                )
                values (
                    envelope_id, target_environment,
                    provider_account_hmac_value, item_hmac_value,
                    item_kind, item->>'error_code',
                    item->>'error_fingerprint_hmac', false,
                    'unknown_message'
                );

                insert into public.v2_support_protected_content (
                    environment, provider_account_hmac, item_hmac,
                    content_kind, content_digest_hmac,
                    content_encryption_key_id,
                    contact_lookup_hmac_key_id,
                    provider_id_hmac_key_id,
                    content_digest_hmac_key_id,
                    message_id, algorithm, key_ref, nonce_b64,
                    ciphertext_b64, aad_sha256
                )
                values (
                    target_environment, provider_account_hmac_value,
                    item_hmac_value, item_kind,
                    item->>'content_digest_hmac',
                    (item#>>'{crypto_key_ids,content_encryption}')::integer,
                    (item#>>'{crypto_key_ids,contact_lookup_hmac}')::integer,
                    (item#>>'{crypto_key_ids,provider_id_hmac}')::integer,
                    (item#>>'{crypto_key_ids,content_digest_hmac}')::integer,
                    null, 'aes256gcm',
                    'whatsapp.content.' ||
                        (item#>>'{crypto_key_ids,content_encryption}'),
                    item#>>'{content_envelope,nonce_base64}',
                    item#>>'{content_envelope,ciphertext_base64}',
                    item#>>'{content_envelope,aad_sha256}'
                );
                rejected_count := rejected_count + 1;
            else
                select link.case_id into case_id_value
                  from public.v2_admin_case_conversations link
                 where link.conversation_id = conversation_id_value
                 order by link.is_primary desc, link.linked_at
                 limit 1;

                insert into public.v2_support_message_status_events (
                    environment, provider_account_hmac, message_id,
                    event_hmac, delivery_status, safe_error_code,
                    error_fingerprint_hmac, content_digest_hmac,
                    provider_occurred_at, received_at
                )
                values (
                    target_environment, provider_account_hmac_value,
                    message_id_value, item_hmac_value,
                    item->>'status', item->>'error_code',
                    item->>'error_fingerprint_hmac',
                    item->>'content_digest_hmac',
                    provider_occurred_at_value, target_received_at
                )
                returning id into status_event_id_value;

                update public.v2_support_messages message
                   set delivery_status = case
                       when item->>'status' = 'read' then 'read'
                       when item->>'status' = 'delivered'
                            and message.delivery_status <> 'read'
                           then 'delivered'
                       when item->>'status' = 'sent'
                            and message.delivery_status = 'not_applicable'
                           then 'provider_accepted'
                       when item->>'status' = 'failed'
                            and message.delivery_status in (
                                'not_applicable', 'provider_accepted'
                            ) then 'failed'
                       else message.delivery_status
                   end
                 where message.id = message_id_value;

                insert into public.v2_support_webhook_items (
                    envelope_id, environment, provider_account_hmac,
                    item_hmac, item_type, safe_error_code,
                    error_fingerprint_hmac, accepted,
                    conversation_id, case_id, message_id
                )
                values (
                    envelope_id, target_environment,
                    provider_account_hmac_value, item_hmac_value,
                    item_kind, item->>'error_code',
                    item->>'error_fingerprint_hmac', true,
                    conversation_id_value, case_id_value,
                    message_id_value
                );

                insert into public.v2_support_protected_content (
                    environment, provider_account_hmac, item_hmac,
                    content_kind, content_digest_hmac,
                    content_encryption_key_id,
                    contact_lookup_hmac_key_id,
                    provider_id_hmac_key_id,
                    content_digest_hmac_key_id,
                    message_id, algorithm, key_ref, nonce_b64,
                    ciphertext_b64, aad_sha256
                )
                values (
                    target_environment, provider_account_hmac_value,
                    item_hmac_value, item_kind,
                    item->>'content_digest_hmac',
                    (item#>>'{crypto_key_ids,content_encryption}')::integer,
                    (item#>>'{crypto_key_ids,contact_lookup_hmac}')::integer,
                    (item#>>'{crypto_key_ids,provider_id_hmac}')::integer,
                    (item#>>'{crypto_key_ids,content_digest_hmac}')::integer,
                    null, 'aes256gcm',
                    'whatsapp.content.' ||
                        (item#>>'{crypto_key_ids,content_encryption}'),
                    item#>>'{content_envelope,nonce_base64}',
                    item#>>'{content_envelope,ciphertext_base64}',
                    item#>>'{content_envelope,aad_sha256}'
                );
                accepted_count := accepted_count + 1;
            end if;
        end if;

        if conversation_id_value is not null
           and not conversation_id_value = any(
               conversation_ids_value
           ) then
            conversation_ids_value := array_append(
                conversation_ids_value, conversation_id_value
            );
        end if;
        if case_id_value is not null
           and not case_id_value = any(case_ids_value) then
            case_ids_value := array_append(case_ids_value, case_id_value);
        end if;
        if shadow_job_id_value is not null
           and not shadow_job_id_value = any(shadow_job_ids_value) then
            shadow_job_ids_value := array_append(
                shadow_job_ids_value, shadow_job_id_value
            );
        end if;
    end loop;

    select coalesce(array_agg(distinct value order by value), '{}'::uuid[])
      into conversation_ids_value
      from unnest(conversation_ids_value) as ids(value);
    select coalesce(array_agg(distinct value order by value), '{}'::uuid[])
      into case_ids_value
      from unnest(case_ids_value) as ids(value);
    select coalesce(array_agg(distinct value order by value), '{}'::uuid[])
      into shadow_job_ids_value
      from unnest(shadow_job_ids_value) as ids(value);

    update public.v2_support_webhook_envelopes
       set processing_status = 'processed',
           accepted_items = accepted_count,
           duplicate_items = duplicate_count,
           rejected_items = rejected_count,
           conversation_ids = conversation_ids_value,
           case_ids = case_ids_value,
           shadow_job_ids = shadow_job_ids_value,
           processed_at = now()
     where id = envelope_id;

    insert into public.v2_admin_audit_events (
        environment, event_type, outcome, actor_principal_id,
        purpose_code, object_type, object_id, requested_action,
        field_keys, sensitivity, version_snapshot, safe_metadata
    )
    values (
        'staging', 'channel.whatsapp_ingested', 'success',
        'c1000000-0000-4000-8000-000000000002',
        'inbound_channel_ingest', 'webhook_envelope', envelope_id,
        'channel.ingest', array['lookup_hmac', 'ciphertext_envelope'],
        'restricted', '{"contract":"ct-r0-v1"}'::jsonb,
        jsonb_build_object(
            'duplicate_envelope', false,
            'channel_mode', target_channel_mode,
            'accepted_items', accepted_count,
            'duplicate_items', duplicate_count,
            'rejected_items', rejected_count
        )
    );

    return jsonb_build_object(
        'schema_version', 1,
        'duplicate_envelope', false,
        'accepted_items', accepted_count,
        'duplicate_items', duplicate_count,
        'rejected_items', rejected_count,
        'conversation_ids', conversation_ids_value,
        'case_ids', case_ids_value,
        'shadow_job_ids', shadow_job_ids_value
    );
end;
$$;

do $$
declare
    function_row record;
begin
    for function_row in
        select procedure.oid::regprocedure::text as identity
          from pg_proc procedure
          join pg_namespace namespace
            on namespace.oid = procedure.pronamespace
         where namespace.nspname = 'public'
           and procedure.proname like 'v2_admin_%'
    loop
        execute format(
            'revoke all on function %s from public, anon, authenticated, service_role',
            function_row.identity
        );
    end loop;
end
$$;

grant execute on function public.v2_admin_get_session()
to authenticated;
grant execute on function public.v2_admin_list_fixture_scenarios()
to authenticated;
grant execute on function public.v2_admin_list_inbox(
    text, text, text, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.v2_admin_get_conversation(uuid)
to authenticated;
grant execute on function public.v2_admin_get_case(uuid)
to authenticated;
grant execute on function public.v2_admin_list_case_messages(
    uuid, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.v2_admin_list_case_timeline(
    uuid, timestamptz, bigint, integer
) to authenticated;
grant execute on function public.v2_admin_get_service360(uuid)
to authenticated;
grant execute on function public.v2_admin_get_parent_safe_incident(uuid)
to authenticated;
grant execute on function public.v2_admin_list_case_actions(uuid)
to authenticated;
grant execute on function public.v2_admin_list_audit_events(
    uuid, timestamptz, bigint, integer
) to authenticated;

grant execute on function public.v2_admin_provision_staff_service(
    uuid, text, text[], text
) to service_role;
grant execute on function public.v2_admin_ingest_whatsapp_webhook_service(
    text, text, text, timestamptz, jsonb
) to service_role;

commit;
