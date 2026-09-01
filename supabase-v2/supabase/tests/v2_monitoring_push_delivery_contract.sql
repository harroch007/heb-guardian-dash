-- Disposable synthetic database contract only. Every fixture is rolled back.
begin;

do $$
begin
    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.status in ('queued', 'failed')
    ) then
        raise exception 'delivery_contract_requires_clean_disposable_queue';
    end if;
end;
$$;

-- The production migration intentionally leaves operational enablement closed.
-- This rolled-back disposable contract prepares the gate before claim tests.
select public.v2_prepare_monitoring_push_activation_internal();

-- This pre-existing claim contract creates every fixture in one long
-- transaction, so now() predates the lock-time cutoff. Move only the rolled-
-- back fixture boundary to the transaction timestamp; the dedicated activation
-- readiness contract verifies the real server-clock boundary.
update public.v2_monitoring_push_activation_epochs epoch
   set activation_cutoff = transaction_timestamp()
 where epoch.singleton;

insert into auth.users (id)
values
    ('21000000-0000-4000-8000-000000000001'),
    ('21000000-0000-4000-8000-000000000002'),
    ('21000000-0000-4000-8000-000000000003');

insert into public.v2_families (id, display_name, status)
values
    (
        '22000000-0000-4000-8000-000000000001',
        'Synthetic monitoring delivery family A',
        'active'
    ),
    (
        '22000000-0000-4000-8000-000000000002',
        'Synthetic monitoring delivery family B',
        'active'
    );

insert into public.v2_guardian_memberships (
    id,
    family_id,
    guardian_user_id,
    role,
    status
)
values
    (
        '22100000-0000-4000-8000-000000000001',
        '22000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001',
        'owner',
        'active'
    ),
    (
        '22100000-0000-4000-8000-000000000002',
        '22000000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000002',
        'guardian',
        'active'
    ),
    (
        '22100000-0000-4000-8000-000000000003',
        '22000000-0000-4000-8000-000000000002',
        '21000000-0000-4000-8000-000000000003',
        'owner',
        'active'
    );

insert into public.v2_children (id, family_id, display_name, status)
values
    (
        '22200000-0000-4000-8000-000000000001',
        '22000000-0000-4000-8000-000000000001',
        'Synthetic monitoring delivery child A',
        'active'
    ),
    (
        '22200000-0000-4000-8000-000000000002',
        '22000000-0000-4000-8000-000000000002',
        'Synthetic monitoring delivery child B',
        'active'
    );

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
)
select
    (
        '22300000-0000-4000-8000-' ||
        lpad(device_number::text, 12, '0')
    )::uuid,
    case
        when device_number in (7, 10, 11)
            then '22200000-0000-4000-8000-000000000002'::uuid
        else '22200000-0000-4000-8000-000000000001'::uuid
    end,
    (
        '22400000-0000-4000-8000-' ||
        lpad(device_number::text, 12, '0')
    )::uuid,
    'synthetic-monitoring-contract',
    case when device_number = 9 then 'revoked' else 'active' end
  from generate_series(1, 13) device_number;

insert into public.v2_guardian_push_endpoints (
    id,
    guardian_user_id,
    installation_id,
    endpoint,
    endpoint_hash,
    p256dh,
    auth_secret,
    user_agent,
    locale,
    permission_state,
    status
)
values
    (
        '22500000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001',
        '22600000-0000-4000-8000-000000000001',
        'https://fcm.googleapis.com/fcm/send/synthetic-monitoring-endpoint-0001',
        repeat('1', 64),
        repeat('A', 88),
        repeat('B', 24),
        'synthetic-contract',
        'he-IL',
        'granted',
        'active'
    ),
    (
        '22500000-0000-4000-8000-000000000002',
        '21000000-0000-4000-8000-000000000002',
        '22600000-0000-4000-8000-000000000002',
        'https://fcm.googleapis.com/fcm/send/synthetic-monitoring-endpoint-0002',
        repeat('2', 64),
        repeat('C', 88),
        repeat('D', 24),
        'synthetic-contract',
        'he-IL',
        'granted',
        'active'
    ),
    (
        '22500000-0000-4000-8000-000000000003',
        '21000000-0000-4000-8000-000000000003',
        '22600000-0000-4000-8000-000000000003',
        'https://fcm.googleapis.com/fcm/send/synthetic-monitoring-endpoint-0003',
        repeat('3', 64),
        repeat('E', 88),
        repeat('F', 24),
        'synthetic-contract',
        'he-IL',
        'granted',
        'active'
    );

insert into public.v2_monitoring_push_worker_capabilities (
    token_hash,
    label,
    expires_at
)
values (
    extensions.digest(
        convert_to(
            'monitoring-contract-capability-token-000001',
            'UTF8'
        ),
        'sha256'
    ),
    'Disposable monitoring delivery SQL contract',
    transaction_timestamp() + interval '1 hour'
);

create function pg_temp.claim_monitoring(target_worker_id uuid)
returns jsonb
language sql
as $$
    select to_jsonb(claimed)
      from public.v2_claim_monitoring_delivery_service(
        'monitoring-contract-capability-token-000001',
        target_worker_id,
        120
      ) claimed;
$$;

create function pg_temp.complete_monitoring(
    target_worker_id uuid,
    target_claim jsonb,
    target_outcome text,
    target_http_status integer,
    target_error_code text
)
returns jsonb
language sql
as $$
    select to_jsonb(completed)
      from public.v2_complete_monitoring_delivery_service(
        'monitoring-contract-capability-token-000001',
        target_worker_id,
        target_claim->>'lease_token',
        (target_claim->>'delivery_id')::uuid,
        jsonb_build_array(
            jsonb_strip_nulls(
                jsonb_build_object(
                    'endpoint_id',
                        target_claim->'targets'->0->>'endpoint_id',
                    'outcome', target_outcome,
                    'http_status', target_http_status,
                    'error_code', target_error_code
                )
            )
        )
      ) completed;
$$;

create function pg_temp.add_interrupted_delivery(
    target_device_id uuid,
    target_transition_id uuid,
    target_episode_id uuid,
    target_delivery_id uuid,
    target_guardian_id uuid,
    target_occurred_at timestamptz default transaction_timestamp()
)
returns void
language plpgsql
as $$
begin
    update public.v2_device_monitoring_state state
       set monitoring_state = 'interrupted',
           state_version = 1,
           episode_id = target_episode_id
     where state.device_id = target_device_id;

    insert into public.v2_device_monitoring_transitions (
        id,
        device_id,
        episode_id,
        previous_state,
        new_state,
        reason_codes,
        source,
        state_version,
        occurred_at
    )
    values (
        target_transition_id,
        target_device_id,
        target_episode_id,
        'protected',
        'interrupted',
        array['synthetic'],
        'system',
        1,
        target_occurred_at
    );

    insert into public.v2_monitoring_alert_deliveries (
        id,
        transition_id,
        guardian_user_id,
        alert_type,
        severity,
        idempotency_key,
        next_attempt_at,
        expires_at
    )
    values (
        target_delivery_id,
        target_transition_id,
        target_guardian_id,
        'monitoring_interrupted',
        'critical',
        'contract:' || target_delivery_id::text,
        transaction_timestamp() - interval '1 second',
        transaction_timestamp() + interval '6 hours'
    );
end;
$$;

-- Rapid action_required -> interrupted: interruption wins while the older row
-- is audibly retained as suppressed.
update public.v2_device_monitoring_state state
   set monitoring_state = 'interrupted',
       state_version = 2,
       episode_id = '22700000-0000-4000-8000-000000000001'
 where state.device_id = '22300000-0000-4000-8000-000000000001';

insert into public.v2_device_monitoring_transitions (
    id,
    device_id,
    episode_id,
    previous_state,
    new_state,
    reason_codes,
    source,
    state_version,
    occurred_at
)
values
    (
        '22800000-0000-4000-8000-000000000001',
        '22300000-0000-4000-8000-000000000001',
        '22700000-0000-4000-8000-000000000001',
        'protected',
        'action_required',
        array['synthetic'],
        'system',
        1,
        transaction_timestamp() - interval '2 minutes'
    ),
    (
        '22800000-0000-4000-8000-000000000002',
        '22300000-0000-4000-8000-000000000001',
        '22700000-0000-4000-8000-000000000001',
        'action_required',
        'interrupted',
        array['synthetic'],
        'system',
        2,
        transaction_timestamp() - interval '1 minute'
    );

insert into public.v2_monitoring_alert_deliveries (
    id,
    transition_id,
    guardian_user_id,
    alert_type,
    severity,
    idempotency_key,
    next_attempt_at,
    expires_at
)
values
    (
        '22900000-0000-4000-8000-000000000001',
        '22800000-0000-4000-8000-000000000001',
        '21000000-0000-4000-8000-000000000001',
        'monitoring_action_required',
        'warning',
        'contract-action-before-interrupted',
        transaction_timestamp() - interval '1 second',
        transaction_timestamp() + interval '6 hours'
    ),
    (
        '22900000-0000-4000-8000-000000000002',
        '22800000-0000-4000-8000-000000000002',
        '21000000-0000-4000-8000-000000000001',
        'monitoring_interrupted',
        'critical',
        'contract-interrupted-winner',
        transaction_timestamp() - interval '1 second',
        transaction_timestamp() + interval '6 hours'
    );

do $$
declare
    claim jsonb;
    completion jsonb;
begin
    claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000001'
    );
    if claim is null
       or claim->>'delivery_id' <>
            '22900000-0000-4000-8000-000000000002'
       or claim->>'alert_type' <> 'monitoring_interrupted'
       or jsonb_array_length(claim->'targets') <> 1
       or char_length(claim->>'lease_token') <> 64 then
        raise exception 'interrupted_winner_claim_failed:%', claim;
    end if;
    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '22900000-0000-4000-8000-000000000001') <>
            'superseded_by_interrupted' then
        raise exception 'action_required_was_not_suppressed_by_interrupted';
    end if;

    completion := pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000001',
        claim,
        'sent',
        201,
        null
    );
    if completion->>'delivery_status' <> 'provider_accepted'
       or (completion->>'provider_accepted_count')::integer <> 1
       or (completion->>'retry_scheduled')::boolean then
        raise exception 'interrupted_completion_failed:%', completion;
    end if;

    begin
        perform pg_temp.complete_monitoring(
            '23000000-0000-4000-8000-000000000001',
            claim,
            'sent',
            201,
            null
        );
        raise exception 'duplicate_completion_was_accepted';
    exception
        when sqlstate '42501' then null;
    end;
end;
$$;

-- Restoration is eligible only because the interruption above was accepted.
update public.v2_device_monitoring_state state
   set monitoring_state = 'protected',
       state_version = 3,
       episode_id = null
 where state.device_id = '22300000-0000-4000-8000-000000000001';

insert into public.v2_device_monitoring_transitions (
    id,
    device_id,
    episode_id,
    previous_state,
    new_state,
    reason_codes,
    source,
    state_version
)
values (
    '22800000-0000-4000-8000-000000000003',
    '22300000-0000-4000-8000-000000000001',
    '22700000-0000-4000-8000-000000000001',
    'recovering',
    'protected',
    array['synthetic'],
    'system',
    3
);

insert into public.v2_monitoring_alert_deliveries (
    id,
    transition_id,
    guardian_user_id,
    alert_type,
    severity,
    idempotency_key,
    next_attempt_at,
    expires_at
)
values (
    '22900000-0000-4000-8000-000000000003',
    '22800000-0000-4000-8000-000000000003',
    '21000000-0000-4000-8000-000000000001',
    'monitoring_restored',
    'info',
    'contract-restored-after-accepted',
    transaction_timestamp() - interval '1 second',
    transaction_timestamp() + interval '1 hour'
);

do $$
declare
    claim jsonb;
    completion jsonb;
begin
    claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000002'
    );
    if claim->>'delivery_id' <>
        '22900000-0000-4000-8000-000000000003' then
        raise exception 'accepted_restoration_claim_failed:%', claim;
    end if;
    completion := pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000002',
        claim,
        'sent',
        201,
        null
    );
    if completion->>'delivery_status' <> 'provider_accepted' then
        raise exception 'accepted_restoration_completion_failed:%', completion;
    end if;
end;
$$;

-- A restoration whose disruption was suppressed is intentionally lost.
update public.v2_device_monitoring_state state
   set monitoring_state = 'protected',
       state_version = 2,
       episode_id = null
 where state.device_id = '22300000-0000-4000-8000-000000000002';

insert into public.v2_device_monitoring_transitions (
    id, device_id, episode_id, previous_state, new_state,
    reason_codes, source, state_version
)
values
    (
        '22800000-0000-4000-8000-000000000004',
        '22300000-0000-4000-8000-000000000002',
        '22700000-0000-4000-8000-000000000002',
        'protected',
        'action_required',
        array['synthetic'],
        'system',
        1
    ),
    (
        '22800000-0000-4000-8000-000000000005',
        '22300000-0000-4000-8000-000000000002',
        '22700000-0000-4000-8000-000000000002',
        'recovering',
        'protected',
        array['synthetic'],
        'system',
        2
    );

insert into public.v2_monitoring_alert_deliveries (
    id, transition_id, guardian_user_id, alert_type, severity,
    status, idempotency_key, next_attempt_at, expires_at,
    suppressed_at, suppression_reason, failure_code
)
values
    (
        '22900000-0000-4000-8000-000000000004',
        '22800000-0000-4000-8000-000000000004',
        '21000000-0000-4000-8000-000000000001',
        'monitoring_action_required',
        'warning',
        'suppressed',
        'contract-suppressed-disruption',
        null,
        transaction_timestamp() + interval '6 hours',
        transaction_timestamp(),
        'pre_activation_cutoff',
        'pre_activation_cutoff'
    ),
    (
        '22900000-0000-4000-8000-000000000005',
        '22800000-0000-4000-8000-000000000005',
        '21000000-0000-4000-8000-000000000001',
        'monitoring_restored',
        'info',
        'queued',
        'contract-restoration-without-accepted',
        transaction_timestamp() - interval '1 second',
        transaction_timestamp() + interval '1 hour',
        null,
        null,
        null
    );

do $$
begin
    if pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000003'
    ) is not null then
        raise exception 'restoration_without_accepted_disruption_was_claimed';
    end if;
    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '22900000-0000-4000-8000-000000000005') <>
            'restoration_without_accepted_disruption' then
        raise exception 'restoration_loss_reason_failed';
    end if;
end;
$$;

-- Two guardian rows for one device can never hold simultaneous leases.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000003',
    '22800000-0000-4000-8000-000000000006',
    '22700000-0000-4000-8000-000000000003',
    '22900000-0000-4000-8000-000000000006',
    '21000000-0000-4000-8000-000000000001'
);
insert into public.v2_monitoring_alert_deliveries (
    id, transition_id, guardian_user_id, alert_type, severity,
    idempotency_key, next_attempt_at, expires_at
)
values (
    '22900000-0000-4000-8000-000000000007',
    '22800000-0000-4000-8000-000000000006',
    '21000000-0000-4000-8000-000000000002',
    'monitoring_interrupted',
    'critical',
    'contract-same-device-second-guardian',
    transaction_timestamp() - interval '1 second',
    transaction_timestamp() + interval '6 hours'
);

do $$
declare
    first_claim jsonb;
    second_claim jsonb;
begin
    first_claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000004'
    );
    second_claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000005'
    );
    if first_claim is null or second_claim is not null then
        raise exception 'per_device_live_lease_serialization_failed';
    end if;
    if (select count(*)
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.id in (
            '22900000-0000-4000-8000-000000000006',
            '22900000-0000-4000-8000-000000000007'
         )
           and delivery.lease_expires_at > now()) <> 1 then
        raise exception 'same_device_active_lease_count_failed';
    end if;

    perform pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000004',
        first_claim,
        'sent',
        201,
        null
    );
    second_claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000005'
    );
    if second_claim is null then
        raise exception 'second_guardian_not_claimable_after_completion';
    end if;
    perform pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000005',
        second_claim,
        'sent',
        201,
        null
    );
end;
$$;

-- Different devices remain parallel while the first device lease is live.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000004',
    '22800000-0000-4000-8000-000000000007',
    '22700000-0000-4000-8000-000000000004',
    '22900000-0000-4000-8000-000000000008',
    '21000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '2 seconds'
);
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000005',
    '22800000-0000-4000-8000-000000000008',
    '22700000-0000-4000-8000-000000000005',
    '22900000-0000-4000-8000-000000000009',
    '21000000-0000-4000-8000-000000000001',
    transaction_timestamp() - interval '1 second'
);

do $$
declare
    first_claim jsonb;
    second_claim jsonb;
begin
    first_claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000006'
    );
    second_claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000007'
    );
    if first_claim is null
       or second_claim is null
       or first_claim->>'device_id' = second_claim->>'device_id' then
        raise exception 'different_device_parallelism_failed:%:%',
            first_claim, second_claim;
    end if;
    perform pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000006',
        first_claim,
        'sent',
        201,
        null
    );
    perform pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000007',
        second_claim,
        'sent',
        201,
        null
    );
end;
$$;

-- Transient failures retry with a bound; attempt five is terminal.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000006',
    '22800000-0000-4000-8000-000000000009',
    '22700000-0000-4000-8000-000000000006',
    '22900000-0000-4000-8000-000000000010',
    '21000000-0000-4000-8000-000000000001'
);

do $$
declare
    claim jsonb;
    completion jsonb;
begin
    claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000008'
    );
    completion := pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000008',
        claim,
        'failed',
        503,
        'push_provider_unavailable'
    );
    if completion->>'delivery_status' <> 'failed'
       or not (completion->>'retry_scheduled')::boolean then
        raise exception 'transient_retry_schedule_failed:%', completion;
    end if;

    update public.v2_monitoring_alert_deliveries delivery
       set attempt_count = 4,
           next_attempt_at = transaction_timestamp() - interval '1 second'
     where delivery.id = '22900000-0000-4000-8000-000000000010';

    claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000009'
    );
    if (claim->>'attempt_number')::integer <> 5 then
        raise exception 'fifth_attempt_claim_failed:%', claim;
    end if;
    completion := pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000009',
        claim,
        'failed',
        503,
        'push_provider_unavailable'
    );
    if completion->>'delivery_status' <> 'failed'
       or (completion->>'retry_scheduled')::boolean
       or (select failure_code
             from public.v2_monitoring_alert_deliveries
            where id = '22900000-0000-4000-8000-000000000010') <>
            'retry_exhausted' then
        raise exception 'bounded_retry_terminal_state_failed:%', completion;
    end if;
end;
$$;

-- Expiry produces a suppression completion and never provider acceptance.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000008',
    '22800000-0000-4000-8000-000000000010',
    '22700000-0000-4000-8000-000000000008',
    '22900000-0000-4000-8000-000000000011',
    '21000000-0000-4000-8000-000000000002'
);

do $$
declare
    claim jsonb;
    completion jsonb;
begin
    claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000010'
    );
    update public.v2_monitoring_alert_deliveries delivery
       set expires_at = transaction_timestamp() + interval '500 milliseconds'
     where delivery.id = (claim->>'delivery_id')::uuid;
    completion := pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000010',
        claim,
        'failed',
        null,
        'delivery_expired'
    );
    if completion->>'delivery_status' <> 'suppressed'
       or completion->>'suppression_reason' <> 'delivery_expired' then
        raise exception 'delivery_expiry_completion_failed:%', completion;
    end if;
end;
$$;

-- 404/410 invalidates the endpoint and suppresses a delivery with no accepted
-- target.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000007',
    '22800000-0000-4000-8000-000000000011',
    '22700000-0000-4000-8000-000000000007',
    '22900000-0000-4000-8000-000000000012',
    '21000000-0000-4000-8000-000000000003'
);

do $$
declare
    claim jsonb;
    completion jsonb;
begin
    claim := pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000011'
    );
    completion := pg_temp.complete_monitoring(
        '23000000-0000-4000-8000-000000000011',
        claim,
        'invalid',
        410,
        'subscription_gone'
    );
    if completion->>'delivery_status' <> 'suppressed'
       or completion->>'suppression_reason' <> 'no_valid_endpoint'
       or (select status
             from public.v2_guardian_push_endpoints
            where id = '22500000-0000-4000-8000-000000000003') <>
            'invalid' then
        raise exception 'endpoint_invalidation_failed:%', completion;
    end if;
end;
$$;

-- Common claim-time checks are deterministic: revoked, inactive membership,
-- pre-cutoff, and no endpoint are all retained as explicit suppression rows.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000009',
    '22800000-0000-4000-8000-000000000012',
    '22700000-0000-4000-8000-000000000009',
    '22900000-0000-4000-8000-000000000013',
    '21000000-0000-4000-8000-000000000001'
);
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000010',
    '22800000-0000-4000-8000-000000000013',
    '22700000-0000-4000-8000-000000000010',
    '22900000-0000-4000-8000-000000000014',
    '21000000-0000-4000-8000-000000000003'
);
update public.v2_guardian_memberships membership
   set status = 'revoked'
 where membership.id = '22100000-0000-4000-8000-000000000003';

do $$
begin
    if pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000012'
    ) is not null then
        raise exception 'revoked_or_inactive_delivery_was_claimed';
    end if;
    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '22900000-0000-4000-8000-000000000013') <>
            'device_revoked'
       or (select suppression_reason
             from public.v2_monitoring_alert_deliveries
            where id = '22900000-0000-4000-8000-000000000014') <>
            'guardian_membership_inactive' then
        raise exception 'revoked_or_inactive_suppression_reason_failed';
    end if;
end;
$$;

update public.v2_guardian_memberships membership
   set status = 'active'
 where membership.id = '22100000-0000-4000-8000-000000000003';

-- Guardian 3's only endpoint was invalidated above.
select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000011',
    '22800000-0000-4000-8000-000000000014',
    '22700000-0000-4000-8000-000000000011',
    '22900000-0000-4000-8000-000000000015',
    '21000000-0000-4000-8000-000000000003'
);

do $$
begin
    if pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000013'
    ) is not null then
        raise exception 'delivery_without_endpoint_was_claimed';
    end if;
    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '22900000-0000-4000-8000-000000000015') <>
            'no_active_endpoint' then
        raise exception 'no_active_endpoint_suppression_reason_failed';
    end if;
end;
$$;

-- The common no-endpoint decision precedes restoration gating, even when the
-- completed episode also has no provider-accepted disruption.
update public.v2_device_monitoring_state state
   set monitoring_state = 'protected',
       state_version = 2,
       episode_id = null
 where state.device_id = '22300000-0000-4000-8000-000000000011';

insert into public.v2_device_monitoring_transitions (
    id, device_id, episode_id, previous_state, new_state,
    reason_codes, source, state_version
)
values (
    '22800000-0000-4000-8000-000000000019',
    '22300000-0000-4000-8000-000000000011',
    '22700000-0000-4000-8000-000000000011',
    'recovering',
    'protected',
    array['synthetic'],
    'system',
    2
);

insert into public.v2_monitoring_alert_deliveries (
    id, transition_id, guardian_user_id, alert_type, severity,
    idempotency_key, next_attempt_at, expires_at
)
values (
    '22900000-0000-4000-8000-000000000017',
    '22800000-0000-4000-8000-000000000019',
    '21000000-0000-4000-8000-000000000003',
    'monitoring_restored',
    'info',
    'contract-restoration-without-endpoint',
    transaction_timestamp() - interval '1 second',
    transaction_timestamp() + interval '1 hour'
);

do $$
begin
    if pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000015'
    ) is not null then
        raise exception 'restoration_without_endpoint_was_claimed';
    end if;
    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '22900000-0000-4000-8000-000000000017') <>
            'no_active_endpoint' then
        raise exception 'common_no_endpoint_precedence_failed';
    end if;
end;
$$;

select pg_temp.add_interrupted_delivery(
    '22300000-0000-4000-8000-000000000012',
    '22800000-0000-4000-8000-000000000018',
    '22700000-0000-4000-8000-000000000012',
    '22900000-0000-4000-8000-000000000016',
    '21000000-0000-4000-8000-000000000002'
);
update public.v2_monitoring_alert_deliveries delivery
   set created_at = (
           select epoch.activation_cutoff - interval '1 minute'
             from public.v2_monitoring_push_activation_epochs epoch
            where epoch.singleton
       ),
       expires_at = transaction_timestamp() + interval '6 hours'
 where delivery.id = '22900000-0000-4000-8000-000000000016';

do $$
begin
    if pg_temp.claim_monitoring(
        '23000000-0000-4000-8000-000000000014'
    ) is not null then
        raise exception 'pre_cutoff_delivery_was_claimed';
    end if;
    if (select suppression_reason
          from public.v2_monitoring_alert_deliveries
         where id = '22900000-0000-4000-8000-000000000016') <>
            'pre_activation_cutoff' then
        raise exception 'pre_cutoff_suppression_reason_failed';
    end if;
end;
$$;

-- Enqueue creates 6h/1h rows and never creates monitoring_late delivery rows.
update public.v2_guardian_memberships membership
   set status = 'active'
 where membership.id = '22100000-0000-4000-8000-000000000003';
insert into public.v2_device_monitoring_transitions (
    id, device_id, episode_id, previous_state, new_state,
    reason_codes, source, state_version, occurred_at
)
values
    (
        '22800000-0000-4000-8000-000000000015',
        '22300000-0000-4000-8000-000000000013',
        '22700000-0000-4000-8000-000000000013',
        'protected',
        'action_required',
        array['synthetic'],
        'system',
        1,
        transaction_timestamp()
    ),
    (
        '22800000-0000-4000-8000-000000000016',
        '22300000-0000-4000-8000-000000000013',
        '22700000-0000-4000-8000-000000000013',
        'action_required',
        'heartbeat_late',
        array['synthetic'],
        'system',
        2,
        transaction_timestamp()
    ),
    (
        '22800000-0000-4000-8000-000000000017',
        '22300000-0000-4000-8000-000000000013',
        '22700000-0000-4000-8000-000000000013',
        'recovering',
        'protected',
        array['synthetic'],
        'system',
        3,
        transaction_timestamp()
    );

select public.v2_enqueue_monitoring_alerts_service(
    '22800000-0000-4000-8000-000000000015'
);
select public.v2_enqueue_monitoring_alerts_service(
    '22800000-0000-4000-8000-000000000016'
);
select public.v2_enqueue_monitoring_alerts_service(
    '22800000-0000-4000-8000-000000000017'
);

do $$
begin
    if (select count(*)
          from public.v2_monitoring_alert_deliveries delivery
         where delivery.transition_id =
            '22800000-0000-4000-8000-000000000015') <> 2
       or exists (
            select 1
              from public.v2_monitoring_alert_deliveries delivery
             where delivery.transition_id =
                '22800000-0000-4000-8000-000000000016'
       )
       or (select count(*)
             from public.v2_monitoring_alert_deliveries delivery
            where delivery.transition_id =
                '22800000-0000-4000-8000-000000000017') <> 2 then
        raise exception 'enqueue_alert_type_contract_failed';
    end if;

    if exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
          join public.v2_device_monitoring_transitions transition
            on transition.id = delivery.transition_id
         where transition.id =
                '22800000-0000-4000-8000-000000000015'
           and delivery.expires_at - transition.occurred_at <>
                interval '6 hours'
    ) or exists (
        select 1
          from public.v2_monitoring_alert_deliveries delivery
          join public.v2_device_monitoring_transitions transition
            on transition.id = delivery.transition_id
         where transition.id =
                '22800000-0000-4000-8000-000000000017'
           and delivery.expires_at - transition.occurred_at <>
                interval '1 hour'
    ) then
        raise exception 'enqueue_expiry_policy_failed';
    end if;

    update public.v2_monitoring_alert_deliveries delivery
       set status = 'suppressed',
           failure_code = 'synthetic_contract_cleanup',
           next_attempt_at = null,
           suppressed_at = transaction_timestamp(),
           suppression_reason = 'synthetic_contract_cleanup'
     where delivery.transition_id in (
        '22800000-0000-4000-8000-000000000015',
        '22800000-0000-4000-8000-000000000017'
     );
end;
$$;

-- ACL, column-level lease secrecy, and RLS remain explicit.
do $$
begin
    if has_function_privilege(
        'anon',
        'public.v2_claim_monitoring_delivery_service(text,uuid,integer)',
        'EXECUTE'
    ) or has_function_privilege(
        'authenticated',
        'public.v2_claim_monitoring_delivery_service(text,uuid,integer)',
        'EXECUTE'
    ) or not has_function_privilege(
        'service_role',
        'public.v2_claim_monitoring_delivery_service(text,uuid,integer)',
        'EXECUTE'
    ) or has_function_privilege(
        'service_role',
        'public.v2_monitoring_push_capability_is_valid(text)',
        'EXECUTE'
    ) or has_function_privilege(
        'service_role',
        'public.v2_suppress_monitoring_delivery_internal(uuid,text,text)',
        'EXECUTE'
    ) then
        raise exception 'monitoring_rpc_acl_contract_failed';
    end if;

    if has_table_privilege(
        'authenticated',
        'public.v2_monitoring_push_endpoint_attempts',
        'SELECT'
    ) or has_table_privilege(
        'anon',
        'public.v2_monitoring_push_worker_capabilities',
        'SELECT'
    ) or has_table_privilege(
        'service_role',
        'public.v2_monitoring_push_activation_epochs',
        'SELECT'
    ) then
        raise exception 'monitoring_internal_table_acl_contract_failed';
    end if;

    if not has_column_privilege(
        'authenticated',
        'public.v2_monitoring_alert_deliveries',
        'id',
        'SELECT'
    ) or has_column_privilege(
        'authenticated',
        'public.v2_monitoring_alert_deliveries',
        'lease_owner',
        'SELECT'
    ) or has_column_privilege(
        'authenticated',
        'public.v2_monitoring_alert_deliveries',
        'lease_token_hash',
        'SELECT'
    ) or has_column_privilege(
        'authenticated',
        'public.v2_monitoring_alert_deliveries',
        'lease_expires_at',
        'SELECT'
    ) then
        raise exception 'monitoring_lease_column_secrecy_failed';
    end if;

    if exists (
        select 1
          from pg_class relation
         where relation.oid in (
            'public.v2_monitoring_push_endpoint_attempts'::regclass,
            'public.v2_monitoring_push_worker_capabilities'::regclass,
            'public.v2_monitoring_push_activation_epochs'::regclass
         )
           and (not relation.relrowsecurity or not relation.relforcerowsecurity)
    ) then
        raise exception 'monitoring_internal_rls_force_failed';
    end if;
end;
$$;

select set_config(
    'request.jwt.claim.sub',
    '21000000-0000-4000-8000-000000000001',
    true
);
set local role authenticated;

do $$
declare
    visible_count bigint;
    foreign_count bigint;
begin
    select count(delivery.id),
           count(delivery.id) filter (
               where delivery.guardian_user_id <>
                    '21000000-0000-4000-8000-000000000001'
           )
      into visible_count, foreign_count
      from public.v2_monitoring_alert_deliveries delivery;
    if visible_count = 0 or foreign_count <> 0 then
        raise exception 'guardian_monitoring_delivery_rls_failed';
    end if;
end;
$$;

reset role;

select 'V2 monitoring push delivery contract: PASS';

rollback;
