-- Disposable synthetic database contract only. Every fixture is rolled back.
begin;

insert into public.v2_families (id, display_name, status)
values
    ('10000000-0000-4000-8000-000000000001', 'Synthetic family A', 'active'),
    ('10000000-0000-4000-8000-000000000002', 'Synthetic family B', 'active');

insert into public.v2_children (id, family_id, display_name, status)
values
    (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        'Synthetic child A',
        'active'
    ),
    (
        '20000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000002',
        'Synthetic child B',
        'active'
    );

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    capture_contract_version,
    status
)
values
    (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        'synthetic',
        2,
        'active'
    ),
    (
        '30000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000002',
        'synthetic',
        2,
        'degraded'
    ),
    (
        '30000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000003',
        'synthetic',
        2,
        'active'
    );

insert into public.v2_parental_settings (
    child_id,
    revision,
    location_tracking_enabled
)
values
    ('20000000-0000-4000-8000-000000000001', 5, true),
    ('20000000-0000-4000-8000-000000000002', 9, true);

do $$
declare
    target_device constant uuid :=
        '30000000-0000-4000-8000-000000000001';
    sibling_device constant uuid :=
        '30000000-0000-4000-8000-000000000002';
    foreign_device constant uuid :=
        '30000000-0000-4000-8000-000000000003';
    enabled_until constant timestamptz := statement_timestamp() + interval '1 hour';
    disabled_until constant timestamptz := statement_timestamp() + interval '2 hours';
    result jsonb;
    snapshot jsonb;
    row_count_value bigint;
begin
    if public.v2_p0_private_text_activation_snapshot_service(
        target_device,
        5
    ) is not null then
        raise exception 'activation_must_be_absent_by_default';
    end if;

    result := public.v2_set_p0_private_text_activation_service(
        target_device,
        true,
        enabled_until,
        5
    );
    if result->>'duplicate' <> 'false'
       or (result->>'settings_revision')::bigint <> 6
       or result->>'enabled' <> 'true' then
        raise exception 'enable_result_contract_failed';
    end if;

    select settings.revision
      into row_count_value
      from public.v2_parental_settings settings
     where settings.child_id =
        '20000000-0000-4000-8000-000000000001';
    if row_count_value <> 6 then
        raise exception 'enable_did_not_atomically_advance_revision';
    end if;

    snapshot := public.v2_p0_private_text_activation_snapshot_service(
        target_device,
        6
    );
    if snapshot->>'contract_version' <> '1'
       or snapshot->>'enabled' <> 'true'
       or (snapshot->>'settings_revision')::bigint <> 6
       or (snapshot->>'valid_until_epoch_ms')::bigint <= 0 then
        raise exception 'enabled_snapshot_contract_failed';
    end if;

    if public.v2_p0_private_text_activation_snapshot_service(
        target_device,
        5
    ) is not null then
        raise exception 'stale_revision_must_fail_closed';
    end if;
    if public.v2_p0_private_text_activation_snapshot_service(
        sibling_device,
        6
    ) is not null then
        raise exception 'grant_leaked_to_sibling_device';
    end if;
    if public.v2_p0_private_text_activation_snapshot_service(
        foreign_device,
        9
    ) is not null then
        raise exception 'grant_leaked_to_foreign_child';
    end if;

    result := public.v2_set_p0_private_text_activation_service(
        target_device,
        true,
        enabled_until,
        5
    );
    if result->>'duplicate' <> 'true'
       or (result->>'settings_revision')::bigint <> 6 then
        raise exception 'exact_retry_was_not_idempotent';
    end if;

    result := public.v2_set_p0_private_text_activation_service(
        target_device,
        false,
        disabled_until,
        6
    );
    if result->>'duplicate' <> 'false'
       or (result->>'settings_revision')::bigint <> 7
       or result->>'enabled' <> 'false' then
        raise exception 'disable_result_contract_failed';
    end if;

    snapshot := public.v2_p0_private_text_activation_snapshot_service(
        target_device,
        7
    );
    if snapshot->>'enabled' <> 'false'
       or (snapshot->>'settings_revision')::bigint <> 7 then
        raise exception 'disabled_snapshot_contract_failed';
    end if;

    select count(*)
      into row_count_value
      from public.v2_p0_private_text_activation_grants;
    if row_count_value <> 1 then
        raise exception 'unexpected_grant_row_count';
    end if;

    select count(*)
      into row_count_value
      from public.v2_device_commands command
     where command.device_id = target_device
       and command.command_type = 'REFRESH_SETTINGS'
       and command.idempotency_key in (
            'p0-private-text:6',
            'p0-private-text:7'
       );
    if row_count_value <> 2 then
        raise exception 'targeted_refresh_contract_failed';
    end if;

    select count(*)
      into row_count_value
      from public.v2_device_commands command
     where command.device_id in (sibling_device, foreign_device)
       and command.idempotency_key like 'p0-private-text:%';
    if row_count_value <> 0 then
        raise exception 'refresh_leaked_to_another_device';
    end if;

    select count(*)
      into row_count_value
      from public.v2_audit_events event
     where event.action = 'v2.parental.p0_private_text_activation.set'
       and event.object_id = target_device;
    if row_count_value <> 2 then
        raise exception 'activation_audit_contract_failed';
    end if;
end;
$$;

do $$
declare
    before_revision bigint;
    after_revision bigint;
begin
    select revision into before_revision
      from public.v2_parental_settings
     where child_id = '20000000-0000-4000-8000-000000000001';

    begin
        perform public.v2_set_p0_private_text_activation_service(
            '30000000-0000-4000-8000-000000000001',
            true,
            statement_timestamp() - interval '1 minute',
            before_revision
        );
        raise exception 'expired_grant_was_accepted';
    exception
        when sqlstate '22023' then null;
    end;

    begin
        perform public.v2_set_p0_private_text_activation_service(
            '30000000-0000-4000-8000-000000000001',
            true,
            statement_timestamp() + interval '25 hours',
            before_revision
        );
        raise exception 'unbounded_grant_was_accepted';
    exception
        when sqlstate '22023' then null;
    end;

    begin
        perform public.v2_set_p0_private_text_activation_service(
            '30000000-0000-4000-8000-000000000001',
            true,
            statement_timestamp() + interval '1 hour',
            before_revision - 1
        );
        raise exception 'stale_writer_revision_was_accepted';
    exception
        when sqlstate '40001' then null;
    end;

    select revision into after_revision
      from public.v2_parental_settings
     where child_id = '20000000-0000-4000-8000-000000000001';
    if after_revision <> before_revision then
        raise exception 'failed_writes_changed_revision';
    end if;
end;
$$;

do $$
begin
    if has_table_privilege(
        'anon',
        'public.v2_p0_private_text_activation_grants',
        'SELECT'
    ) or has_table_privilege(
        'authenticated',
        'public.v2_p0_private_text_activation_grants',
        'SELECT'
    ) or has_table_privilege(
        'service_role',
        'public.v2_p0_private_text_activation_grants',
        'SELECT'
    ) then
        raise exception 'activation_table_direct_read_grant_detected';
    end if;

    if has_function_privilege(
        'anon',
        'public.v2_set_p0_private_text_activation_service(uuid,boolean,timestamptz,bigint)',
        'EXECUTE'
    ) or has_function_privilege(
        'authenticated',
        'public.v2_set_p0_private_text_activation_service(uuid,boolean,timestamptz,bigint)',
        'EXECUTE'
    ) or not has_function_privilege(
        'service_role',
        'public.v2_set_p0_private_text_activation_service(uuid,boolean,timestamptz,bigint)',
        'EXECUTE'
    ) then
        raise exception 'activation_writer_acl_contract_failed';
    end if;
end;
$$;

rollback;
