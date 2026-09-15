begin;

-- Monitoring delivery is deliberately independent from the confirmed-incident
-- push lane. Lease fields are the in-flight marker; no new public status is
-- introduced.
alter table public.v2_monitoring_alert_deliveries
    add column attempt_count integer not null default 0
        check (attempt_count between 0 and 20),
    add column next_attempt_at timestamptz,
    add column lease_owner uuid,
    add column lease_token_hash bytea
        check (
            lease_token_hash is null
            or octet_length(lease_token_hash) = 32
        ),
    add column lease_expires_at timestamptz,
    add column expires_at timestamptz,
    add column suppressed_at timestamptz,
    add column suppression_reason text
        check (
            suppression_reason is null
            or (
                char_length(suppression_reason) between 1 and 80
                and suppression_reason ~ '^[a-z0-9_]+$'
            )
        );

update public.v2_monitoring_alert_deliveries delivery
   set next_attempt_at = case
           when delivery.status in ('queued', 'failed')
               then delivery.created_at
           else null
       end,
       expires_at = delivery.created_at + case delivery.alert_type
           when 'monitoring_restored' then interval '1 hour'
           when 'monitoring_late' then interval '0 seconds'
           else interval '6 hours'
       end,
       suppressed_at = case
           when delivery.status = 'suppressed'
               then coalesce(delivery.attempted_at, delivery.created_at)
           else null
       end,
       suppression_reason = case
           when delivery.status = 'suppressed'
               and delivery.failure_code is not null
               and char_length(delivery.failure_code) between 1 and 80
               and delivery.failure_code ~ '^[a-z0-9_]+$'
               then delivery.failure_code
           when delivery.status = 'suppressed'
               then 'legacy_suppressed'
           else null
       end;

alter table public.v2_monitoring_alert_deliveries
    alter column next_attempt_at set default now(),
    alter column expires_at set not null,
    add constraint v2_monitoring_delivery_expiry_shape
        check (expires_at >= created_at),
    add constraint v2_monitoring_delivery_lease_shape
        check (
            (
                lease_owner is null
                and lease_token_hash is null
                and lease_expires_at is null
            )
            or (
                lease_owner is not null
                and lease_token_hash is not null
                and lease_expires_at is not null
            )
        ),
    add constraint v2_monitoring_delivery_suppression_shape
        check (
            (
                status = 'suppressed'
                and suppressed_at is not null
                and suppression_reason is not null
                and next_attempt_at is null
            )
            or (
                status <> 'suppressed'
                and suppressed_at is null
                and suppression_reason is null
            )
        );

drop index public.v2_monitoring_alert_outbox;

create index v2_monitoring_alert_delivery_queue
    on public.v2_monitoring_alert_deliveries(
        next_attempt_at,
        created_at,
        id
    )
    where status in ('queued', 'failed')
      and next_attempt_at is not null;

create index v2_monitoring_alert_delivery_active_leases
    on public.v2_monitoring_alert_deliveries(lease_expires_at)
    where lease_expires_at is not null;

create table public.v2_monitoring_push_endpoint_attempts (
    delivery_id uuid not null
        references public.v2_monitoring_alert_deliveries(id)
        on delete cascade,
    endpoint_id uuid not null
        references public.v2_guardian_push_endpoints(id)
        on delete restrict,
    status text not null default 'queued'
        check (
            status in (
                'queued',
                'provider_accepted',
                'failed',
                'invalid'
            )
        ),
    attempt_count integer not null default 0
        check (attempt_count between 0 and 20),
    last_http_status smallint
        check (
            last_http_status is null
            or last_http_status between 100 and 599
        ),
    last_error_code text
        check (
            last_error_code is null
            or (
                char_length(last_error_code) between 1 and 80
                and last_error_code ~ '^[a-z0-9_]+$'
            )
        ),
    last_attempt_at timestamptz,
    provider_accepted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (delivery_id, endpoint_id)
);

create trigger v2_monitoring_push_attempts_set_updated_at
before update on public.v2_monitoring_push_endpoint_attempts
for each row execute function public.v2_set_updated_at();

alter table public.v2_monitoring_push_endpoint_attempts
    enable row level security;
alter table public.v2_monitoring_push_endpoint_attempts
    force row level security;

revoke all on table public.v2_monitoring_push_endpoint_attempts
from public, anon, authenticated;
grant all on table public.v2_monitoring_push_endpoint_attempts
to service_role;

create table public.v2_monitoring_push_worker_capabilities (
    token_hash bytea primary key
        check (octet_length(token_hash) = 32),
    label text not null
        check (char_length(label) between 1 and 120),
    status text not null default 'active'
        check (status in ('active', 'revoked')),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (
        (status = 'active' and revoked_at is null)
        or (status = 'revoked' and revoked_at is not null)
    )
);

alter table public.v2_monitoring_push_worker_capabilities
    enable row level security;
alter table public.v2_monitoring_push_worker_capabilities
    force row level security;

revoke all on table public.v2_monitoring_push_worker_capabilities
from public, anon, authenticated;
grant all on table public.v2_monitoring_push_worker_capabilities
to service_role;

-- The activation migration inserts exactly one runtime cutoff. Claiming fails
-- closed while the row is absent, and the cutoff cannot be silently changed.
create table public.v2_monitoring_push_activation_epochs (
    singleton boolean primary key default true
        check (singleton),
    activation_cutoff timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.v2_monitoring_push_activation_epochs
    enable row level security;
alter table public.v2_monitoring_push_activation_epochs
    force row level security;

revoke all on table public.v2_monitoring_push_activation_epochs
from public, anon, authenticated, service_role;

-- Compare fixed-length digests without an early exit. This helper and the
-- validator remain owner-only; the Edge worker can call only claim/complete.
create or replace function public.v2_constant_time_digest_equal_internal(
    left_digest bytea,
    right_digest bytea
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
    difference integer := 0;
begin
    if left_digest is null
       or right_digest is null
       or octet_length(left_digest) <> 32
       or octet_length(right_digest) <> 32 then
        return false;
    end if;

    for digest_index in 0..31 loop
        difference := difference |
            (
                get_byte(left_digest, digest_index)
                # get_byte(right_digest, digest_index)
            );
    end loop;
    return difference = 0;
end;
$$;

create or replace function public.v2_monitoring_push_capability_is_valid(
    target_capability_token text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    supplied_hash bytea;
    stored_hash bytea;
    matched_count integer := 0;
begin
    if target_capability_token is null
       or char_length(target_capability_token) not between 32 and 256 then
        return false;
    end if;

    supplied_hash := extensions.digest(
        convert_to(target_capability_token, 'UTF8'),
        'sha256'
    );

    for stored_hash in
        select capability.token_hash
          from public.v2_monitoring_push_worker_capabilities capability
         where capability.status = 'active'
           and capability.expires_at > now()
    loop
        matched_count := matched_count + case
            when public.v2_constant_time_digest_equal_internal(
                supplied_hash,
                stored_hash
            ) then 1
            else 0
        end;
    end loop;

    return matched_count > 0;
end;
$$;

-- One suppression primitive keeps claim-time reasons and audit records in the
-- same transaction. It is not a service-role RPC.
create or replace function public.v2_suppress_monitoring_delivery_internal(
    target_delivery_id uuid,
    target_reason text,
    target_actor_type text default 'service'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    delivery public.v2_monitoring_alert_deliveries%rowtype;
begin
    if target_delivery_id is null
       or target_reason is null
       or char_length(target_reason) not between 1 and 80
       or target_reason !~ '^[a-z0-9_]+$'
       or target_actor_type not in ('service', 'system') then
        raise exception 'invalid_monitoring_suppression'
            using errcode = '22023';
    end if;

    select candidate.*
      into delivery
      from public.v2_monitoring_alert_deliveries candidate
     where candidate.id = target_delivery_id
     for update;

    if not found or delivery.status not in ('queued', 'failed') then
        return false;
    end if;

    update public.v2_monitoring_alert_deliveries candidate
       set status = 'suppressed',
           failure_code = target_reason,
           next_attempt_at = null,
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null,
           suppressed_at = now(),
           suppression_reason = target_reason
     where candidate.id = delivery.id;

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        target_actor_type,
        'v2.monitoring.push_delivery.suppress',
        'monitoring_alert_delivery',
        delivery.id,
        'success',
        jsonb_build_object(
            'reason', target_reason,
            'alert_type', delivery.alert_type,
            'attempt_count', delivery.attempt_count
        )
    );

    return true;
end;
$$;

-- Late remains visible in canonical monitoring state but is no longer added to
-- the Web Push outbox. Expiry is part of every newly enqueued delivery.
create or replace function public.v2_enqueue_monitoring_alerts_service(
    target_transition_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    transition public.v2_device_monitoring_transitions%rowtype;
    resolved_alert_type text;
    resolved_severity text;
    resolved_expires_at timestamptz;
begin
    select item.*
      into transition
      from public.v2_device_monitoring_transitions item
     where item.id = target_transition_id;

    if transition.id is null then
        return;
    end if;

    resolved_alert_type := case
        when transition.new_state = 'action_required'
            then 'monitoring_action_required'
        when transition.new_state = 'interrupted'
            then 'monitoring_interrupted'
        when transition.new_state in ('protected', 'degraded')
             and transition.previous_state = 'recovering'
            then 'monitoring_restored'
        else null
    end;
    if resolved_alert_type is null then
        return;
    end if;

    resolved_severity := case resolved_alert_type
        when 'monitoring_interrupted' then 'critical'
        when 'monitoring_restored' then 'info'
        else 'warning'
    end;
    resolved_expires_at := transition.occurred_at +
        case resolved_alert_type
            when 'monitoring_restored' then interval '1 hour'
            else interval '6 hours'
        end;

    insert into public.v2_monitoring_alert_deliveries (
        transition_id,
        guardian_user_id,
        alert_type,
        severity,
        idempotency_key,
        next_attempt_at,
        expires_at
    )
    select
        transition.id,
        membership.guardian_user_id,
        resolved_alert_type,
        resolved_severity,
        resolved_alert_type || ':' ||
            transition.id::text || ':' ||
            membership.guardian_user_id::text,
        now(),
        resolved_expires_at
      from public.v2_protected_devices device
      join public.v2_children child
        on child.id = device.child_id
      join public.v2_guardian_memberships membership
        on membership.family_id = child.family_id
       and membership.status = 'active'
     where device.id = transition.device_id
    on conflict (transition_id, guardian_user_id, alert_type) do nothing;
end;
$$;

create or replace function public.v2_claim_monitoring_delivery_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_seconds integer default 120
)
returns table (
    delivery_id uuid,
    transition_id uuid,
    device_id uuid,
    child_id uuid,
    episode_id uuid,
    transition_state_version bigint,
    alert_type text,
    severity text,
    lease_token text,
    attempt_number integer,
    expires_at timestamptz,
    targets jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    candidate_delivery public.v2_monitoring_alert_deliveries%rowtype;
    candidate_transition public.v2_device_monitoring_transitions%rowtype;
    current_state public.v2_device_monitoring_state%rowtype;
    current_device public.v2_protected_devices%rowtype;
    selected_delivery_id uuid;
    resolved_family_id uuid;
    activation_cutoff timestamptz;
    raw_lease_token text;
    resolved_targets jsonb;
    suppression_code text;
    superseded_delivery_id uuid;
    pending_target_count integer;
    accepted_target_count integer;
    skipped_device_ids uuid[] := array[]::uuid[];
begin
    if not public.v2_monitoring_push_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_monitoring_push_worker_capability'
            using errcode = '42501';
    end if;

    if target_worker_id is null
       or target_lease_seconds is null
       or target_lease_seconds not between 30 and 300 then
        raise exception 'invalid_monitoring_push_worker_claim'
            using errcode = '22023';
    end if;

    select epoch.activation_cutoff
      into activation_cutoff
      from public.v2_monitoring_push_activation_epochs epoch
     where epoch.singleton;
    if activation_cutoff is null then
        raise exception 'monitoring_push_activation_cutoff_missing'
            using errcode = '55000';
    end if;

    -- A bounded scan lets one invocation retire stale rows before returning at
    -- most one eligible claim. Device-state locks are always acquired before
    -- delivery-row locks, avoiding cross-worker lock inversion.
    for scan_number in 1..64 loop
        select candidate.*
          into candidate_delivery
          from public.v2_monitoring_alert_deliveries candidate
          join public.v2_device_monitoring_transitions transition
            on transition.id = candidate.transition_id
         where candidate.status in ('queued', 'failed')
           and candidate.next_attempt_at is not null
           and candidate.next_attempt_at <= now()
           and candidate.attempt_count < 5
           and (
                candidate.lease_owner is null
                or candidate.lease_expires_at <= now()
           )
           and not (transition.device_id = any(skipped_device_ids))
         order by
            transition.occurred_at,
            transition.state_version,
            candidate.created_at,
            candidate.id
         limit 1;

        if not found then
            return;
        end if;
        selected_delivery_id := candidate_delivery.id;

        select transition.*
          into candidate_transition
          from public.v2_device_monitoring_transitions transition
         where transition.id = candidate_delivery.transition_id;
        if not found then
            perform public.v2_suppress_monitoring_delivery_internal(
                candidate_delivery.id,
                'monitoring_transition_missing'
            );
            continue;
        end if;

        select state.*
          into current_state
          from public.v2_device_monitoring_state state
         where state.device_id = candidate_transition.device_id
         for update;
        if not found then
            perform public.v2_suppress_monitoring_delivery_internal(
                candidate_delivery.id,
                'monitoring_state_missing'
            );
            continue;
        end if;

        -- The persisted lease is checked while the canonical device-state row
        -- is locked. A live external-send lease prevents every second claim for
        -- the same device, but does not block a different device.
        if exists (
            select 1
              from public.v2_monitoring_alert_deliveries leased
              join public.v2_device_monitoring_transitions leased_transition
                on leased_transition.id = leased.transition_id
             where leased_transition.device_id = current_state.device_id
               and leased.id <> selected_delivery_id
               and leased.lease_expires_at > now()
        ) then
            skipped_device_ids := array_append(
                skipped_device_ids,
                current_state.device_id
            );
            continue;
        end if;

        -- Re-lock and revalidate the selected row only after the device lock.
        -- Another transaction may have completed or suppressed it between the
        -- initial non-locking scan and this point.
        select candidate.*
          into candidate_delivery
          from public.v2_monitoring_alert_deliveries candidate
         where candidate.id = selected_delivery_id
           and candidate.status in ('queued', 'failed')
           and candidate.next_attempt_at is not null
           and candidate.next_attempt_at <= now()
           and candidate.attempt_count < 5
           and (
                candidate.lease_owner is null
                or candidate.lease_expires_at <= now()
           )
         for update skip locked;
        if not found then
            skipped_device_ids := array_append(
                skipped_device_ids,
                current_state.device_id
            );
            continue;
        end if;

        select device.*
          into current_device
          from public.v2_protected_devices device
         where device.id = candidate_transition.device_id;
        select child.family_id
          into resolved_family_id
          from public.v2_children child
         where child.id = current_device.child_id;

        suppression_code := null;
        if current_device.id is null then
            suppression_code := 'protected_device_missing';
        elsif current_device.status = 'revoked' then
            suppression_code := 'device_revoked';
        elsif current_device.status not in ('active', 'degraded') then
            suppression_code := 'device_not_delivery_eligible';
        elsif not exists (
            select 1
              from public.v2_guardian_memberships membership
             where membership.family_id = resolved_family_id
               and membership.guardian_user_id =
                    candidate_delivery.guardian_user_id
               and membership.status = 'active'
        ) then
            suppression_code := 'guardian_membership_inactive';
        elsif candidate_delivery.created_at < activation_cutoff then
            suppression_code := 'pre_activation_cutoff';
        elsif candidate_delivery.expires_at <= now() then
            suppression_code := 'delivery_expired';
        elsif candidate_delivery.alert_type = 'monitoring_late' then
            suppression_code := 'monitoring_late_in_app_only';
        elsif candidate_transition.episode_id is null then
            suppression_code := 'monitoring_transition_invalid';
        elsif not exists (
            select 1
              from public.v2_guardian_push_endpoints endpoint
             where endpoint.guardian_user_id =
                    candidate_delivery.guardian_user_id
               and endpoint.status = 'active'
               and endpoint.permission_state = 'granted'
               and public.v2_valid_web_push_endpoint(endpoint.endpoint)
        ) then
            suppression_code := 'no_active_endpoint';
        end if;

        if suppression_code is not null then
            perform public.v2_suppress_monitoring_delivery_internal(
                candidate_delivery.id,
                suppression_code
            );
            continue;
        end if;

        -- Once no external-send lease exists, interrupted supersedes every
        -- still-unsent action-required row in that episode.
        for superseded_delivery_id in
            select earlier.id
              from public.v2_monitoring_alert_deliveries earlier
              join public.v2_device_monitoring_transitions earlier_transition
                on earlier_transition.id = earlier.transition_id
             where earlier.status in ('queued', 'failed')
               and (
                    earlier.lease_owner is null
                    or earlier.lease_expires_at <= now()
               )
               and earlier.alert_type = 'monitoring_action_required'
               and earlier_transition.device_id =
                    candidate_transition.device_id
               and earlier_transition.episode_id =
                    candidate_transition.episode_id
               and exists (
                    select 1
                      from public.v2_device_monitoring_transitions interruption
                     where interruption.device_id =
                            earlier_transition.device_id
                       and interruption.episode_id =
                            earlier_transition.episode_id
                       and interruption.new_state = 'interrupted'
                       and interruption.state_version >
                            earlier_transition.state_version
               )
             order by earlier_transition.state_version, earlier.id
        loop
            perform public.v2_suppress_monitoring_delivery_internal(
                superseded_delivery_id,
                'superseded_by_interrupted'
            );
        end loop;

        select candidate.*
          into candidate_delivery
          from public.v2_monitoring_alert_deliveries candidate
         where candidate.id = selected_delivery_id;
        if candidate_delivery.status not in ('queued', 'failed') then
            continue;
        end if;

        suppression_code := null;
        if candidate_delivery.alert_type = 'monitoring_action_required' then
            if exists (
                select 1
                  from public.v2_device_monitoring_transitions interruption
                 where interruption.device_id = candidate_transition.device_id
                   and interruption.episode_id = candidate_transition.episode_id
                   and interruption.new_state = 'interrupted'
                   and interruption.state_version >
                        candidate_transition.state_version
            ) then
                suppression_code := 'superseded_by_interrupted';
            elsif current_state.monitoring_state <> 'action_required'
               or current_state.episode_id is distinct from
                    candidate_transition.episode_id
               or current_state.state_version <>
                    candidate_transition.state_version then
                suppression_code :=
                    'superseded_by_recovery_or_newer_episode';
            end if;
        elsif candidate_delivery.alert_type = 'monitoring_interrupted' then
            if current_state.monitoring_state <> 'interrupted'
               or current_state.episode_id is distinct from
                    candidate_transition.episode_id
               or current_state.state_version <>
                    candidate_transition.state_version then
                suppression_code :=
                    'superseded_by_recovery_or_newer_episode';
            end if;
        elsif candidate_delivery.alert_type = 'monitoring_restored' then
            if candidate_transition.new_state not in ('protected', 'degraded')
               or candidate_transition.previous_state <> 'recovering'
               or current_state.monitoring_state not in ('protected', 'degraded')
               or current_state.state_version <>
                    candidate_transition.state_version then
                suppression_code :=
                    'superseded_by_recovery_or_newer_episode';
            elsif not exists (
                select 1
                  from public.v2_monitoring_alert_deliveries disruption
                  join public.v2_device_monitoring_transitions
                       disruption_transition
                    on disruption_transition.id = disruption.transition_id
                 where disruption.guardian_user_id =
                        candidate_delivery.guardian_user_id
                   and disruption.alert_type in (
                        'monitoring_action_required',
                        'monitoring_interrupted'
                   )
                   and disruption_transition.device_id =
                        candidate_transition.device_id
                   and disruption_transition.episode_id =
                        candidate_transition.episode_id
                   and (
                        disruption.status in (
                            'provider_accepted',
                            'delivered',
                            'opened',
                            'acknowledged'
                        )
                        or exists (
                            select 1
                              from public.v2_monitoring_push_endpoint_attempts
                                   accepted_attempt
                             where accepted_attempt.delivery_id = disruption.id
                               and accepted_attempt.status =
                                    'provider_accepted'
                        )
                   )
            ) then
                suppression_code :=
                    'restoration_without_accepted_disruption';
            end if;
        else
            suppression_code := 'monitoring_alert_type_not_push_eligible';
        end if;

        if suppression_code is not null then
            perform public.v2_suppress_monitoring_delivery_internal(
                candidate_delivery.id,
                suppression_code
            );
            continue;
        end if;

        insert into public.v2_monitoring_push_endpoint_attempts (
            delivery_id,
            endpoint_id
        )
        select
            candidate_delivery.id,
            endpoint.id
          from public.v2_guardian_push_endpoints endpoint
         where endpoint.guardian_user_id =
                candidate_delivery.guardian_user_id
           and endpoint.status = 'active'
           and endpoint.permission_state = 'granted'
           and public.v2_valid_web_push_endpoint(endpoint.endpoint)
         order by endpoint.last_seen_at desc, endpoint.id
         limit 8
        on conflict on constraint
            v2_monitoring_push_endpoint_attempts_pkey
        do nothing;

        update public.v2_monitoring_push_endpoint_attempts attempt
           set status = 'invalid',
               last_error_code = 'endpoint_inactive',
               last_attempt_at = now()
          from public.v2_guardian_push_endpoints endpoint
         where attempt.delivery_id = candidate_delivery.id
           and endpoint.id = attempt.endpoint_id
           and attempt.status in ('queued', 'failed')
           and (
                endpoint.guardian_user_id <>
                    candidate_delivery.guardian_user_id
                or endpoint.status <> 'active'
                or endpoint.permission_state <> 'granted'
                or not public.v2_valid_web_push_endpoint(endpoint.endpoint)
           );

        select
            count(*) filter (
                where attempt.status in ('queued', 'failed')
            )::integer,
            count(*) filter (
                where attempt.status = 'provider_accepted'
            )::integer
          into pending_target_count, accepted_target_count
          from public.v2_monitoring_push_endpoint_attempts attempt
         where attempt.delivery_id = candidate_delivery.id;

        if pending_target_count = 0 then
            if accepted_target_count > 0 then
                update public.v2_monitoring_alert_deliveries candidate
                   set status = 'provider_accepted',
                       failure_code = null,
                       next_attempt_at = null,
                       lease_owner = null,
                       lease_token_hash = null,
                       lease_expires_at = null
                 where candidate.id = candidate_delivery.id;

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
                    'v2.monitoring.push_delivery.finalize_accepted',
                    'monitoring_alert_delivery',
                    candidate_delivery.id,
                    'success',
                    jsonb_build_object(
                        'provider_accepted_count', accepted_target_count,
                        'reason', 'no_pending_targets'
                    )
                );
            else
                perform public.v2_suppress_monitoring_delivery_internal(
                    candidate_delivery.id,
                    'no_active_endpoint'
                );
            end if;
            continue;
        end if;

        raw_lease_token := encode(
            extensions.gen_random_bytes(32),
            'hex'
        );

        update public.v2_monitoring_alert_deliveries candidate
           set attempt_count = candidate.attempt_count + 1,
               attempted_at = now(),
               lease_owner = target_worker_id,
               lease_token_hash = extensions.digest(
                    convert_to(raw_lease_token, 'UTF8'),
                    'sha256'
               ),
               lease_expires_at = now() + make_interval(
                    secs => target_lease_seconds
               )
         where candidate.id = candidate_delivery.id
        returning candidate.*
          into candidate_delivery;

        select coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'endpoint_id', endpoint.id,
                    'endpoint', endpoint.endpoint,
                    'p256dh', endpoint.p256dh,
                    'auth', endpoint.auth_secret
                )
                order by endpoint.id
            ),
            '[]'::jsonb
        )
          into resolved_targets
          from public.v2_monitoring_push_endpoint_attempts attempt
          join public.v2_guardian_push_endpoints endpoint
            on endpoint.id = attempt.endpoint_id
         where attempt.delivery_id = candidate_delivery.id
           and attempt.status in ('queued', 'failed')
           and endpoint.status = 'active'
           and endpoint.permission_state = 'granted'
           and public.v2_valid_web_push_endpoint(endpoint.endpoint);

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
            'v2.monitoring.push_delivery.claim',
            'monitoring_alert_delivery',
            candidate_delivery.id,
            'success',
            jsonb_build_object(
                'attempt_number', candidate_delivery.attempt_count,
                'target_count', jsonb_array_length(resolved_targets),
                'lease_seconds', target_lease_seconds,
                'alert_type', candidate_delivery.alert_type
            )
        );

        return query
        select
            candidate_delivery.id,
            candidate_transition.id,
            candidate_transition.device_id,
            current_device.child_id,
            candidate_transition.episode_id,
            candidate_transition.state_version,
            candidate_delivery.alert_type,
            candidate_delivery.severity,
            raw_lease_token,
            candidate_delivery.attempt_count,
            candidate_delivery.expires_at,
            resolved_targets;
        return;
    end loop;
end;
$$;

create or replace function public.v2_complete_monitoring_delivery_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_token text,
    target_delivery_id uuid,
    target_results jsonb
)
returns table (
    delivery_status text,
    provider_accepted_count integer,
    invalid_target_count integer,
    retry_scheduled boolean,
    suppression_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    delivery public.v2_monitoring_alert_deliveries%rowtype;
    result_item jsonb;
    result_endpoint_id uuid;
    result_outcome text;
    result_error_code text;
    result_http_status integer;
    seen_endpoint_ids uuid[] := array[]::uuid[];
    expected_result_count integer;
    failed_result_count integer := 0;
    total_accepted_count integer := 0;
    total_invalid_count integer := 0;
    resolved_status text;
    resolved_failure_code text;
    resolved_suppression_reason text;
    resolved_next_attempt timestamptz;
    retry_delay interval;
    should_retry boolean := false;
    saw_expired_signal boolean := false;
begin
    if not public.v2_monitoring_push_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_monitoring_push_worker_capability'
            using errcode = '42501';
    end if;

    if target_worker_id is null
       or target_lease_token is null
       or char_length(target_lease_token) <> 64
       or target_lease_token !~ '^[0-9a-f]{64}$'
       or target_delivery_id is null
       or target_results is null
       or jsonb_typeof(target_results) <> 'array'
       or jsonb_array_length(target_results) not between 1 and 8 then
        raise exception 'invalid_monitoring_push_delivery_results'
            using errcode = '22023';
    end if;

    select candidate.*
      into delivery
      from public.v2_monitoring_alert_deliveries candidate
     where candidate.id = target_delivery_id
     for update;

    if not found
       or delivery.status not in ('queued', 'failed')
       or delivery.lease_owner is distinct from target_worker_id
       or delivery.lease_expires_at <= now()
       or delivery.lease_token_hash is distinct from
            extensions.digest(
                convert_to(target_lease_token, 'UTF8'),
                'sha256'
            ) then
        raise exception 'invalid_or_expired_monitoring_push_lease'
            using errcode = '42501';
    end if;

    select count(*)::integer
      into expected_result_count
      from public.v2_monitoring_push_endpoint_attempts attempt
     where attempt.delivery_id = delivery.id
       and attempt.status in ('queued', 'failed');

    if jsonb_array_length(target_results) <> expected_result_count then
        raise exception 'incomplete_monitoring_push_delivery_results'
            using errcode = '22023';
    end if;

    for result_item in
        select item.value
          from jsonb_array_elements(target_results) item
    loop
        begin
            if jsonb_typeof(result_item) <> 'object'
               or result_item - array[
                    'endpoint_id',
                    'outcome',
                    'http_status',
                    'error_code'
               ] <> '{}'::jsonb then
                raise exception 'invalid_result_shape';
            end if;
            result_endpoint_id :=
                (result_item ->> 'endpoint_id')::uuid;
            result_outcome := result_item ->> 'outcome';
            result_error_code := result_item ->> 'error_code';
            result_http_status := case
                when result_item ? 'http_status'
                 and jsonb_typeof(result_item -> 'http_status') = 'number'
                    then (result_item ->> 'http_status')::integer
                else null
            end;
        exception
            when others then
                raise exception 'invalid_monitoring_push_delivery_results'
                    using errcode = '22023';
        end;

        if result_endpoint_id is null
           or result_endpoint_id = any(seen_endpoint_ids)
           or result_outcome not in ('sent', 'invalid', 'failed')
           or (
                result_http_status is not null
                and result_http_status not between 100 and 599
           )
           or (
                result_outcome = 'sent'
                and (
                    result_http_status is null
                    or result_http_status not between 200 and 299
                    or result_error_code is not null
                )
           )
           or (
                result_outcome = 'invalid'
                and (
                    result_http_status is null
                    or result_http_status not in (404, 410)
                    or result_error_code is null
                )
           )
           or (
                result_outcome = 'failed'
                and (
                    result_error_code is null
                    or result_http_status between 200 and 299
                    or result_http_status in (404, 410)
                )
           )
           or (
                result_outcome <> 'sent'
                and (
                    char_length(result_error_code) not between 1 and 80
                    or result_error_code !~ '^[a-z0-9_]+$'
                )
           )
           or not exists (
                select 1
                  from public.v2_monitoring_push_endpoint_attempts attempt
                 where attempt.delivery_id = delivery.id
                   and attempt.endpoint_id = result_endpoint_id
                   and attempt.status in ('queued', 'failed')
           ) then
            raise exception 'invalid_monitoring_push_delivery_results'
                using errcode = '22023';
        end if;

        if result_error_code = 'delivery_expired' then
            saw_expired_signal := true;
        end if;

        seen_endpoint_ids := array_append(
            seen_endpoint_ids,
            result_endpoint_id
        );

        update public.v2_monitoring_push_endpoint_attempts attempt
           set status = case result_outcome
                   when 'sent' then 'provider_accepted'
                   else result_outcome
               end,
               attempt_count = attempt.attempt_count + 1,
               last_http_status = result_http_status,
               last_error_code = result_error_code,
               last_attempt_at = now(),
               provider_accepted_at = case
                   when result_outcome = 'sent'
                       then coalesce(attempt.provider_accepted_at, now())
                   else attempt.provider_accepted_at
               end
         where attempt.delivery_id = delivery.id
           and attempt.endpoint_id = result_endpoint_id;

        if result_outcome = 'sent' then
            update public.v2_guardian_push_endpoints endpoint
               set last_success_at = now(),
                   last_error_code = null
             where endpoint.id = result_endpoint_id;
        elsif result_outcome = 'invalid' then
            update public.v2_guardian_push_endpoints endpoint
               set status = 'invalid',
                   invalidated_at = now(),
                   last_error_code = result_error_code
             where endpoint.id = result_endpoint_id;
        else
            failed_result_count := failed_result_count + 1;
            update public.v2_guardian_push_endpoints endpoint
               set last_error_code = result_error_code
             where endpoint.id = result_endpoint_id;
        end if;
    end loop;

    if saw_expired_signal
       and floor(extract(epoch from (delivery.expires_at - now()))) > 0 then
        raise exception 'premature_monitoring_delivery_expiry'
            using errcode = '22023';
    end if;

    select
        count(*) filter (
            where attempt.status = 'provider_accepted'
        )::integer,
        count(*) filter (
            where attempt.status = 'invalid'
        )::integer
      into total_accepted_count, total_invalid_count
      from public.v2_monitoring_push_endpoint_attempts attempt
     where attempt.delivery_id = delivery.id;

    resolved_suppression_reason := null;
    resolved_next_attempt := null;

    if saw_expired_signal then
        if total_accepted_count > 0 then
            resolved_status := 'provider_accepted';
            resolved_failure_code := 'partial_delivery';
        else
            resolved_status := 'suppressed';
            resolved_failure_code := 'delivery_expired';
            resolved_suppression_reason := 'delivery_expired';
        end if;
    elsif failed_result_count > 0 then
        retry_delay := case delivery.attempt_count
            when 1 then interval '15 seconds'
            when 2 then interval '1 minute'
            when 3 then interval '5 minutes'
            else interval '15 minutes'
        end;

        if delivery.attempt_count < 5
           and now() + retry_delay < delivery.expires_at then
            resolved_status := 'failed';
            resolved_failure_code := 'push_provider_transient';
            resolved_next_attempt := now() + retry_delay;
            should_retry := true;
        elsif total_accepted_count > 0 then
            resolved_status := 'provider_accepted';
            resolved_failure_code := 'partial_delivery';
        elsif delivery.attempt_count >= 5 then
            resolved_status := 'failed';
            resolved_failure_code := 'retry_exhausted';
        else
            resolved_status := 'suppressed';
            resolved_failure_code := 'delivery_expired';
            resolved_suppression_reason := 'delivery_expired';
        end if;
    elsif total_accepted_count > 0 then
        resolved_status := 'provider_accepted';
        resolved_failure_code := null;
    else
        resolved_status := 'suppressed';
        resolved_failure_code := case
            when total_invalid_count > 0
                then 'no_valid_endpoint'
            else 'no_active_endpoint'
        end;
        resolved_suppression_reason := resolved_failure_code;
    end if;

    update public.v2_monitoring_alert_deliveries candidate
       set status = resolved_status,
           failure_code = resolved_failure_code,
           next_attempt_at = resolved_next_attempt,
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null,
           suppressed_at = case
               when resolved_status = 'suppressed' then now()
               else null
           end,
           suppression_reason = resolved_suppression_reason
     where candidate.id = delivery.id;

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
        'v2.monitoring.push_delivery.complete',
        'monitoring_alert_delivery',
        delivery.id,
        case
            when resolved_status in ('provider_accepted', 'suppressed')
                then 'success'
            else 'failed'
        end,
        jsonb_build_object(
            'status', resolved_status,
            'attempt_number', delivery.attempt_count,
            'provider_accepted_count', total_accepted_count,
            'invalid_target_count', total_invalid_count,
            'retry_scheduled', should_retry,
            'suppression_reason', resolved_suppression_reason
        )
    );

    return query
    select
        resolved_status,
        total_accepted_count,
        total_invalid_count,
        should_retry,
        resolved_suppression_reason;
end;
$$;

-- Guardians retain RLS-scoped access to their delivery history, but lease
-- material is service-only and is intentionally excluded from column grants.
revoke all on table public.v2_monitoring_alert_deliveries
from authenticated;
grant select (
    id,
    transition_id,
    guardian_user_id,
    alert_type,
    severity,
    status,
    idempotency_key,
    provider_message_id,
    failure_code,
    attempted_at,
    delivered_at,
    opened_at,
    acknowledged_at,
    created_at,
    attempt_count,
    next_attempt_at,
    expires_at,
    suppressed_at,
    suppression_reason
) on public.v2_monitoring_alert_deliveries
to authenticated;

revoke all on function
    public.v2_constant_time_digest_equal_internal(bytea, bytea),
    public.v2_monitoring_push_capability_is_valid(text),
    public.v2_suppress_monitoring_delivery_internal(uuid, text, text)
from public, anon, authenticated, service_role;

revoke all on function
    public.v2_claim_monitoring_delivery_service(text, uuid, integer),
    public.v2_complete_monitoring_delivery_service(
        text,
        uuid,
        text,
        uuid,
        jsonb
    )
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_claim_monitoring_delivery_service(text, uuid, integer),
    public.v2_complete_monitoring_delivery_service(
        text,
        uuid,
        text,
        uuid,
        jsonb
    )
to service_role;

comment on table public.v2_monitoring_push_endpoint_attempts is
    'Monitoring-only per-browser Web Push attempts. provider_accepted means the push service accepted the encrypted payload, not that a guardian saw it.';
comment on table public.v2_monitoring_push_activation_epochs is
    'Immutable runtime activation cutoff for the monitoring push lane. Claiming fails closed until exactly one row exists.';
comment on function public.v2_claim_monitoring_delivery_service(
    text,
    uuid,
    integer
) is
    'Claims at most one relevant monitoring delivery with a persisted per-device lease. Separate from confirmed safety-incident delivery.';
comment on function public.v2_complete_monitoring_delivery_service(
    text,
    uuid,
    text,
    uuid,
    jsonb
) is
    'Completes one leased monitoring Web Push attempt with bounded retries, endpoint invalidation, and auditable suppression.';

commit;
