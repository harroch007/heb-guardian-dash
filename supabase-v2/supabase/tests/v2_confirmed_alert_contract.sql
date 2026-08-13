\set ON_ERROR_STOP on

begin;

insert into auth.users (id)
values ('12000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name)
values (
    '22000000-0000-4000-8000-000000000001',
    'Confirmed alert family'
);

insert into public.v2_guardian_memberships (
    family_id,
    guardian_user_id,
    role,
    status
)
values (
    '22000000-0000-4000-8000-000000000001',
    '12000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name)
values (
    '32000000-0000-4000-8000-000000000001',
    '22000000-0000-4000-8000-000000000001',
    'Confirmed alert child'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
)
values (
    '42000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '2.0.0-test',
    'active'
);

insert into public.v2_safety_incidents (
    id,
    device_id,
    child_id,
    client_incident_id,
    category,
    severity,
    child_role,
    confidence,
    capture_quality,
    occurred_at
)
values
    (
        '62000000-0000-4000-8000-000000000001',
        '42000000-0000-4000-8000-000000000001',
        '32000000-0000-4000-8000-000000000001',
        '72000000-0000-4000-8000-000000000001',
        'bullying',
        'medium',
        'target',
        0.9,
        0.9,
        now() - interval '1 minute'
    ),
    (
        '62000000-0000-4000-8000-000000000002',
        '42000000-0000-4000-8000-000000000001',
        '32000000-0000-4000-8000-000000000001',
        '72000000-0000-4000-8000-000000000002',
        'violence',
        'high',
        'target',
        0.9,
        0.9,
        now() - interval '1 minute'
    );

do $$
begin
    begin
        insert into public.v2_alert_deliveries (
            incident_id,
            guardian_user_id,
            channel,
            idempotency_key
        )
        values (
            '62000000-0000-4000-8000-000000000001',
            '12000000-0000-4000-8000-000000000001',
            'in_app',
            'must-be-rejected'
        );
        raise exception 'Unconfirmed alert delivery was accepted';
    exception
        when check_violation then
            null;
    end;
end
$$;

select *
from public.v2_finalize_incident_analysis_internal(
    '62000000-0000-4000-8000-000000000001'::uuid,
    'dismissed',
    'no_actionable_risk',
    'no_action',
    'bullying',
    'test-provider',
    'test-model',
    'test-version',
    'test-prompt',
    2::smallint
);

do $$
begin
    begin
        perform *
        from public.v2_finalize_incident_analysis_internal(
            '62000000-0000-4000-8000-000000000002'::uuid,
            'confirmed',
            'bullying_pattern',
            'professional_support',
            'violence',
            'test-provider',
            'test-model',
            'test-version',
            'test-prompt',
            2::smallint
        );
        raise exception
            'Internal finalizer accepted contradictory category and reason';
    exception
        when invalid_parameter_value then
            null;
    end;
end
$$;

select *
from public.v2_finalize_incident_analysis_internal(
    '62000000-0000-4000-8000-000000000002'::uuid,
    'confirmed',
    'violence_risk',
    'professional_support',
    'violence',
    'test-provider',
    'test-model',
    'test-version',
    'test-prompt',
    2::smallint
);

do $$
declare
    dismissed_deliveries integer;
    confirmed_deliveries integer;
begin
    select count(*)
      into dismissed_deliveries
      from public.v2_alert_deliveries
     where incident_id =
        '62000000-0000-4000-8000-000000000001';

    select count(*)
      into confirmed_deliveries
      from public.v2_alert_deliveries
     where incident_id =
        '62000000-0000-4000-8000-000000000002';

    if dismissed_deliveries <> 0
       or confirmed_deliveries <> 1 then
        raise exception
            'Confirmed-only delivery failed: dismissed=%, confirmed=%',
            dismissed_deliveries,
            confirmed_deliveries;
    end if;

    if not exists (
        select 1
        from public.v2_incident_analysis analysis
        where analysis.incident_id =
            '62000000-0000-4000-8000-000000000002'
          and analysis.reason_code = 'violence_risk'
          and analysis.action_code = 'professional_support'
          and analysis.safe_summary =
            public.v2_parent_summary_template('violence')
          and analysis.safe_reason =
            public.v2_parent_reason_template('violence_risk')
          and analysis.recommended_action =
            public.v2_parent_action_template('professional_support')
    ) then
        raise exception
            'Server-owned Hebrew projection template mismatch';
    end if;

    begin
        update public.v2_incident_analysis
           set safe_summary = 'Mutation must fail'
         where incident_id =
            '62000000-0000-4000-8000-000000000002';
        raise exception 'Final analysis update was accepted';
    exception
        when check_violation then
            null;
    end;

    begin
        delete from public.v2_incident_analysis
         where incident_id =
            '62000000-0000-4000-8000-000000000002';
        raise exception 'Final analysis delete was accepted';
    exception
        when check_violation then
            null;
    end;

    begin
        insert into public.v2_alert_deliveries (
            incident_id,
            guardian_user_id,
            channel,
            idempotency_key
        )
        values (
            '62000000-0000-4000-8000-000000000002',
            '12000000-0000-4000-8000-000000000001',
            'in_app',
            'alternate-key-must-not-duplicate'
        );
        raise exception 'Duplicate alert tuple was accepted';
    exception
        when unique_violation then
            null;
    end;
end
$$;

do $$
begin
    if has_function_privilege(
        'service_role',
        'public.v2_finalize_incident_analysis_internal(uuid,text,text,text,text,text,text,text,text,smallint)',
        'EXECUTE'
    ) then
        raise exception
            'Shared service role can finalize expert analysis';
    end if;

    if has_table_privilege(
        'service_role',
        'public.v2_incident_analysis',
        'INSERT,UPDATE,DELETE'
    ) then
        raise exception
            'Shared service role has direct analysis DML';
    end if;
end
$$;

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '12000000-0000-4000-8000-000000000001',
    true
);

do $$
declare
    visible_incidents integer;
    visible_analyses integer;
    visible_deliveries integer;
begin
    select count(*)
      into visible_incidents
      from public.v2_safety_incidents;
    select count(*)
      into visible_analyses
      from public.v2_incident_analysis;
    select count(*)
      into visible_deliveries
      from public.v2_alert_deliveries;

    if visible_incidents <> 1
       or visible_analyses <> 1
       or visible_deliveries <> 1 then
        raise exception
            'Guardian confirmed-only visibility failed: incidents=%, analyses=%, deliveries=%',
            visible_incidents,
            visible_analyses,
            visible_deliveries;
    end if;
end
$$;

reset role;
rollback;
