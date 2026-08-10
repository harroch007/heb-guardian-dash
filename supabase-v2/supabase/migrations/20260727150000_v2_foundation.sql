begin;

create table public.v2_families (
    id uuid primary key default gen_random_uuid(),
    display_name text not null check (char_length(display_name) between 1 and 120),
    status text not null default 'active'
        check (status in ('active', 'suspended', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_guardian_memberships (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null references public.v2_families(id) on delete cascade,
    guardian_user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('owner', 'guardian')),
    status text not null default 'active'
        check (status in ('invited', 'active', 'revoked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (family_id, guardian_user_id)
);

create unique index v2_one_active_owner_per_family
    on public.v2_guardian_memberships(family_id)
    where role = 'owner' and status = 'active';

create table public.v2_children (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null references public.v2_families(id) on delete restrict,
    display_name text not null check (char_length(display_name) between 1 and 120),
    birth_year smallint check (
        birth_year is null or birth_year between 2000 and 2100
    ),
    status text not null default 'active'
        check (status in ('active', 'paused', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_protected_devices (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null references public.v2_children(id) on delete restrict,
    installation_id uuid not null unique,
    platform text not null default 'android' check (platform = 'android'),
    app_version text not null,
    capture_contract_version smallint not null default 2
        check (capture_contract_version >= 2),
    manufacturer text,
    model text,
    status text not null default 'pending'
        check (status in ('pending', 'active', 'degraded', 'revoked')),
    registered_at timestamptz not null default now(),
    last_seen_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_device_credentials (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.v2_protected_devices(id) on delete cascade,
    credential_hash text not null,
    key_version integer not null check (key_version > 0),
    valid_from timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    unique (device_id, key_version),
    check (expires_at > valid_from)
);

create unique index v2_one_live_device_credential
    on public.v2_device_credentials(device_id)
    where revoked_at is null;

create table public.v2_device_health_events (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.v2_protected_devices(id) on delete cascade,
    event_key uuid not null,
    capture_ready boolean not null,
    accessibility_enabled boolean not null,
    notification_listener_enabled boolean not null,
    battery_optimization_exempt boolean not null,
    oem_autostart_state text not null
        check (oem_autostart_state in ('not_applicable', 'confirmed', 'review_required')),
    degraded_reasons text[] not null default '{}',
    observed_at timestamptz not null,
    received_at timestamptz not null default now(),
    unique (device_id, event_key),
    check (observed_at <= received_at + interval '10 minutes')
);

create index v2_device_health_device_observed
    on public.v2_device_health_events(device_id, observed_at desc);

create table public.v2_device_commands (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.v2_protected_devices(id) on delete cascade,
    command_type text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'pending'
        check (status in ('pending', 'claimed', 'completed', 'failed', 'expired')),
    idempotency_key text not null,
    not_before timestamptz not null default now(),
    expires_at timestamptz not null,
    claimed_at timestamptz,
    completed_at timestamptz,
    failure_code text,
    created_at timestamptz not null default now(),
    unique (device_id, idempotency_key),
    check (expires_at > not_before)
);

create index v2_device_commands_poll
    on public.v2_device_commands(device_id, status, not_before)
    where status = 'pending';

create table public.v2_safety_incidents (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.v2_protected_devices(id) on delete restrict,
    child_id uuid not null references public.v2_children(id) on delete restrict,
    client_incident_id uuid not null,
    category text not null check (category in (
        'bullying', 'exclusion', 'sexual_content', 'violence',
        'grooming', 'manipulation', 'stranger_contact', 'self_harm', 'other'
    )),
    severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
    child_role text not null check (child_role in ('target', 'participant', 'initiator', 'unknown')),
    confidence real not null check (confidence between 0 and 1),
    capture_quality real not null check (capture_quality between 0 and 1),
    occurred_at timestamptz not null,
    received_at timestamptz not null default now(),
    status text not null default 'received'
        check (status in ('received', 'analyzing', 'confirmed', 'dismissed', 'alerted')),
    model_contract_version smallint not null default 2 check (model_contract_version >= 2),
    unique (device_id, client_incident_id),
    check (occurred_at <= received_at + interval '10 minutes')
);

create index v2_incidents_child_received
    on public.v2_safety_incidents(child_id, received_at desc);

create table public.v2_incident_context (
    incident_id uuid primary key
        references public.v2_safety_incidents(id) on delete cascade,
    encrypted_payload bytea not null,
    encryption_algorithm text not null,
    key_version integer not null check (key_version > 0),
    message_count smallint not null check (message_count between 1 and 40),
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (expires_at <= created_at + interval '7 days')
);

create index v2_incident_context_expiry
    on public.v2_incident_context(expires_at);

create table public.v2_alert_deliveries (
    id uuid primary key default gen_random_uuid(),
    incident_id uuid not null references public.v2_safety_incidents(id) on delete cascade,
    guardian_user_id uuid not null references auth.users(id) on delete cascade,
    channel text not null check (channel in ('push', 'email', 'in_app')),
    status text not null default 'pending'
        check (status in ('pending', 'sent', 'delivered', 'failed', 'suppressed')),
    idempotency_key text not null unique,
    provider_message_id text,
    failure_code text,
    attempted_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz not null default now()
);

create table public.v2_audit_events (
    id bigint generated always as identity primary key,
    actor_user_id uuid references auth.users(id) on delete set null,
    actor_type text not null check (actor_type in ('guardian', 'device', 'service', 'system')),
    action text not null,
    object_type text not null,
    object_id uuid,
    outcome text not null check (outcome in ('success', 'denied', 'failed')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index v2_audit_events_created_at
    on public.v2_audit_events(created_at desc);

create or replace function public.v2_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger v2_families_set_updated_at
before update on public.v2_families
for each row execute function public.v2_set_updated_at();

create trigger v2_guardian_memberships_set_updated_at
before update on public.v2_guardian_memberships
for each row execute function public.v2_set_updated_at();

create trigger v2_children_set_updated_at
before update on public.v2_children
for each row execute function public.v2_set_updated_at();

create trigger v2_protected_devices_set_updated_at
before update on public.v2_protected_devices
for each row execute function public.v2_set_updated_at();

create or replace function public.v2_is_family_guardian(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.v2_guardian_memberships membership
        where membership.family_id = target_family_id
          and membership.guardian_user_id = auth.uid()
          and membership.status = 'active'
    );
$$;

revoke all on function public.v2_is_family_guardian(uuid) from public;
grant execute on function public.v2_is_family_guardian(uuid) to authenticated;

alter table public.v2_families enable row level security;
alter table public.v2_families force row level security;
alter table public.v2_guardian_memberships enable row level security;
alter table public.v2_guardian_memberships force row level security;
alter table public.v2_children enable row level security;
alter table public.v2_children force row level security;
alter table public.v2_protected_devices enable row level security;
alter table public.v2_protected_devices force row level security;
alter table public.v2_device_credentials enable row level security;
alter table public.v2_device_credentials force row level security;
alter table public.v2_device_health_events enable row level security;
alter table public.v2_device_health_events force row level security;
alter table public.v2_device_commands enable row level security;
alter table public.v2_device_commands force row level security;
alter table public.v2_safety_incidents enable row level security;
alter table public.v2_safety_incidents force row level security;
alter table public.v2_incident_context enable row level security;
alter table public.v2_incident_context force row level security;
alter table public.v2_alert_deliveries enable row level security;
alter table public.v2_alert_deliveries force row level security;
alter table public.v2_audit_events enable row level security;
alter table public.v2_audit_events force row level security;

create policy v2_guardians_read_family
on public.v2_families for select
to authenticated
using (public.v2_is_family_guardian(id));

create policy v2_guardians_read_memberships
on public.v2_guardian_memberships for select
to authenticated
using (public.v2_is_family_guardian(family_id));

create policy v2_guardians_read_children
on public.v2_children for select
to authenticated
using (public.v2_is_family_guardian(family_id));

create policy v2_guardians_read_devices
on public.v2_protected_devices for select
to authenticated
using (
    exists (
        select 1
        from public.v2_children child
        where child.id = child_id
          and public.v2_is_family_guardian(child.family_id)
    )
);

create policy v2_guardians_read_device_health
on public.v2_device_health_events for select
to authenticated
using (
    exists (
        select 1
        from public.v2_protected_devices device
        join public.v2_children child on child.id = device.child_id
        where device.id = device_id
          and public.v2_is_family_guardian(child.family_id)
    )
);

create policy v2_guardians_read_incidents
on public.v2_safety_incidents for select
to authenticated
using (
    exists (
        select 1
        from public.v2_children child
        where child.id = child_id
          and public.v2_is_family_guardian(child.family_id)
    )
);

create policy v2_guardians_read_alerts
on public.v2_alert_deliveries for select
to authenticated
using (
    guardian_user_id = auth.uid()
    and exists (
        select 1
        from public.v2_safety_incidents incident
        join public.v2_children child on child.id = incident.child_id
        where incident.id = incident_id
          and public.v2_is_family_guardian(child.family_id)
    )
);

revoke all on table
    public.v2_families,
    public.v2_guardian_memberships,
    public.v2_children,
    public.v2_protected_devices,
    public.v2_device_credentials,
    public.v2_device_health_events,
    public.v2_device_commands,
    public.v2_safety_incidents,
    public.v2_incident_context,
    public.v2_alert_deliveries,
    public.v2_audit_events
from anon;

revoke all on table
    public.v2_families,
    public.v2_guardian_memberships,
    public.v2_children,
    public.v2_protected_devices,
    public.v2_device_credentials,
    public.v2_device_health_events,
    public.v2_device_commands,
    public.v2_safety_incidents,
    public.v2_incident_context,
    public.v2_alert_deliveries,
    public.v2_audit_events
from authenticated;

grant select on table
    public.v2_families,
    public.v2_guardian_memberships,
    public.v2_children,
    public.v2_protected_devices,
    public.v2_device_health_events,
    public.v2_safety_incidents,
    public.v2_alert_deliveries
to authenticated;

commit;
