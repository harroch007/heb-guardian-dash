begin;

-- Server-owned, per-device rollout state for the private WhatsApp text P0
-- path. Absence is OFF. The row is never guardian-readable or writable.
create table public.v2_p0_private_text_activation_grants (
    device_id uuid primary key
        references public.v2_protected_devices(id) on delete cascade,
    child_id uuid not null
        references public.v2_children(id) on delete restrict,
    contract_version smallint not null default 1
        check (contract_version = 1),
    enabled boolean not null default false,
    valid_until timestamptz not null,
    settings_revision bigint not null check (settings_revision > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (valid_until > created_at),
    unique (device_id, child_id)
);

create index v2_p0_private_text_activation_expiry
    on public.v2_p0_private_text_activation_grants(valid_until);

create trigger v2_p0_private_text_activation_set_updated_at
before update on public.v2_p0_private_text_activation_grants
for each row execute function public.v2_set_updated_at();

alter table public.v2_p0_private_text_activation_grants enable row level security;
alter table public.v2_p0_private_text_activation_grants force row level security;

revoke all on table public.v2_p0_private_text_activation_grants
from public, anon, authenticated, service_role;

-- This is the only writer. It derives child scope from the target device,
-- serializes against parental settings, and advances that same revision in the
-- transaction that changes the grant. Repeating an identical request is a
-- no-op even when the caller still supplies the preceding expected revision.
create or replace function public.v2_set_p0_private_text_activation_service(
    target_device_id uuid,
    target_enabled boolean,
    target_valid_until timestamptz,
    target_expected_settings_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_child_id uuid;
    current_revision bigint;
    next_revision bigint;
    current_grant public.v2_p0_private_text_activation_grants%rowtype;
begin
    if target_device_id is null
       or target_enabled is null
       or target_valid_until is null
       or target_expected_settings_revision is null
       or target_expected_settings_revision < 0
       or target_valid_until <= statement_timestamp()
       or target_valid_until > statement_timestamp() + interval '24 hours' then
        raise exception 'invalid_p0_private_text_activation'
            using errcode = '22023';
    end if;

    select device.child_id
      into target_child_id
      from public.v2_protected_devices device
      join public.v2_children child
        on child.id = device.child_id
       and child.status = 'active'
      join public.v2_families family
        on family.id = child.family_id
       and family.status = 'active'
     where device.id = target_device_id
       and device.status in ('active', 'degraded')
     for update of device;

    if target_child_id is null then
        raise exception 'device_not_active'
            using errcode = '42501';
    end if;

    select settings.revision
      into current_revision
      from public.v2_parental_settings settings
     where settings.child_id = target_child_id
     for update;
    current_revision := coalesce(current_revision, 0);

    select grant_row.*
      into current_grant
      from public.v2_p0_private_text_activation_grants grant_row
     where grant_row.device_id = target_device_id
     for update;

    if current_grant.device_id is not null
       and current_grant.child_id = target_child_id
       and current_grant.contract_version = 1
       and current_grant.enabled = target_enabled
       and current_grant.valid_until = target_valid_until
       and current_grant.settings_revision = current_revision then
        return jsonb_build_object(
            'duplicate', true,
            'settings_revision', current_revision,
            'enabled', current_grant.enabled,
            'valid_until_epoch_ms',
                floor(extract(epoch from current_grant.valid_until) * 1000)::bigint
        );
    end if;

    if current_revision <> target_expected_settings_revision then
        raise exception 'settings_revision_conflict'
            using errcode = '40001';
    end if;

    next_revision := public.v2_bump_parental_revision_service(
        target_child_id,
        null::uuid
    );

    insert into public.v2_p0_private_text_activation_grants (
        device_id,
        child_id,
        contract_version,
        enabled,
        valid_until,
        settings_revision
    )
    values (
        target_device_id,
        target_child_id,
        1,
        target_enabled,
        target_valid_until,
        next_revision
    )
    on conflict (device_id) do update
       set child_id = excluded.child_id,
           contract_version = excluded.contract_version,
           enabled = excluded.enabled,
           valid_until = excluded.valid_until,
           settings_revision = excluded.settings_revision;

    insert into public.v2_device_commands (
        device_id,
        command_type,
        payload,
        status,
        idempotency_key,
        not_before,
        expires_at,
        requested_by
    )
    values (
        target_device_id,
        'REFRESH_SETTINGS',
        jsonb_build_object('settings_revision', next_revision),
        'pending',
        'p0-private-text:' || next_revision::text,
        statement_timestamp(),
        statement_timestamp() + interval '5 minutes',
        null
    )
    on conflict (device_id, idempotency_key) do nothing;

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        null,
        'service',
        'v2.parental.p0_private_text_activation.set',
        'device',
        target_device_id,
        'success',
        jsonb_build_object(
            'contract_version', 1,
            'enabled', target_enabled,
            'settings_revision', next_revision,
            'valid_until_epoch_ms',
                floor(extract(epoch from target_valid_until) * 1000)::bigint
        )
    );

    return jsonb_build_object(
        'duplicate', false,
        'settings_revision', next_revision,
        'enabled', target_enabled,
        'valid_until_epoch_ms',
            floor(extract(epoch from target_valid_until) * 1000)::bigint
    );
end;
$$;

-- Read side for the device-authenticated Edge Function. The caller supplies
-- the revision from the durable parental snapshot; a concurrent grant change
-- therefore yields NULL rather than a mixed-revision response.
create or replace function public.v2_p0_private_text_activation_snapshot_service(
    target_device_id uuid,
    target_settings_revision bigint
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'contract_version', grant_row.contract_version,
        'enabled', grant_row.enabled,
        'valid_until_epoch_ms',
            floor(extract(epoch from grant_row.valid_until) * 1000)::bigint,
        'settings_revision', grant_row.settings_revision
    )
      from public.v2_p0_private_text_activation_grants grant_row
      join public.v2_protected_devices device
        on device.id = grant_row.device_id
       and device.child_id = grant_row.child_id
       and device.status in ('active', 'degraded')
      join public.v2_children child
        on child.id = device.child_id
       and child.status = 'active'
      join public.v2_families family
        on family.id = child.family_id
       and family.status = 'active'
     where grant_row.device_id = target_device_id
       and grant_row.contract_version = 1
       and grant_row.settings_revision = target_settings_revision
       and grant_row.valid_until > statement_timestamp();
$$;

revoke all on function public.v2_set_p0_private_text_activation_service(
    uuid,
    boolean,
    timestamptz,
    bigint
) from public, anon, authenticated;
grant execute on function public.v2_set_p0_private_text_activation_service(
    uuid,
    boolean,
    timestamptz,
    bigint
) to service_role;

revoke all on function public.v2_p0_private_text_activation_snapshot_service(
    uuid,
    bigint
) from public, anon, authenticated;
grant execute on function public.v2_p0_private_text_activation_snapshot_service(
    uuid,
    bigint
) to service_role;

comment on table public.v2_p0_private_text_activation_grants is
    'Server-owned, per-device and time-bounded rollout state for the private WhatsApp text P0 path. Absence is OFF.';
comment on function public.v2_set_p0_private_text_activation_service(
    uuid,
    boolean,
    timestamptz,
    bigint
) is
    'Atomically changes one device rollout grant, advances the canonical parental settings revision, audits it and queues only that device to refresh.';
comment on function public.v2_p0_private_text_activation_snapshot_service(
    uuid,
    bigint
) is
    'Returns the current revision-matched activation contract for exactly one active device, or NULL when absent, expired or mismatched.';

commit;
