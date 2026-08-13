\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_false(
    condition boolean,
    failure_message text
)
returns boolean
language plpgsql
as $$
begin
    if condition then
        raise exception '%', failure_message;
    end if;
    return true;
end
$$;

insert into auth.users (id)
values ('15000000-0000-4000-8000-000000000001');

insert into public.v2_families (id, display_name)
values (
    '25000000-0000-4000-8000-000000000001',
    'Ephemeral expert contract family'
);

insert into public.v2_guardian_memberships (
    family_id,
    guardian_user_id,
    role,
    status
) values (
    '25000000-0000-4000-8000-000000000001',
    '15000000-0000-4000-8000-000000000001',
    'owner',
    'active'
);

insert into public.v2_children (id, family_id, display_name)
values (
    '35000000-0000-4000-8000-000000000001',
    '25000000-0000-4000-8000-000000000001',
    'Ephemeral expert contract child'
);

insert into public.v2_protected_devices (
    id,
    child_id,
    installation_id,
    app_version,
    status
) values (
    '45000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000001',
    '2.0.0-test',
    'active'
);

set local role service_role;

select *
from public.v2_begin_ephemeral_incident_analysis_service(
    '45000000-0000-4000-8000-000000000001'::uuid,
    '75000000-0000-4000-8000-000000000001'::uuid,
    'exclusion'::text,
    'high'::text,
    'target'::text,
    0.9::real,
    0.95::real,
    date_trunc('milliseconds', now() - interval '1 minute'),
    2::smallint,
    3::smallint,
    7::bigint,
    1::integer,
    2::smallint,
    date_trunc('milliseconds', now() + interval '1 day'),
    repeat('ab', 32),
    120::integer
)
\gset first_

reset role;

select case
    when :'first_created'::boolean is true
     and :'first_analysis_state' = 'leased'
     and char_length(:'first_lease_token') = 64
    then true
    else pg_temp.assert_false(
        true,
        'Ephemeral begin did not create a valid lease'
    )
end;

select pg_temp.assert_false(
    exists (
        select 1
        from public.v2_incident_context context
        where context.incident_id = :'first_incident_id'::uuid
    ),
    'V3 raw context was persisted'
);

select pg_temp.assert_false(
    exists (
        select 1
        from public.v2_incident_analysis_jobs job
        where job.incident_id = :'first_incident_id'::uuid
    ),
    'V3 incident incorrectly entered the stored-context worker'
);

select case
    when exists (
        select 1
        from public.v2_ephemeral_incident_receipts receipt
        where receipt.incident_id = :'first_incident_id'::uuid
          and octet_length(receipt.submission_hash) = 32
          and receipt.state = 'leased'
    ) then true
    else pg_temp.assert_false(
        true,
        'Content-free V3 receipt is missing'
    )
end;

set local role service_role;

select *
from public.v2_begin_ephemeral_incident_analysis_service(
    '45000000-0000-4000-8000-000000000001'::uuid,
    '75000000-0000-4000-8000-000000000001'::uuid,
    'exclusion'::text,
    'high'::text,
    'target'::text,
    0.9::real,
    0.95::real,
    date_trunc('milliseconds', now() - interval '1 minute'),
    2::smallint,
    3::smallint,
    7::bigint,
    1::integer,
    2::smallint,
    date_trunc('milliseconds', now() + interval '1 day'),
    repeat('ab', 32),
    120::integer
)
\gset busy_

select public.v2_release_ephemeral_incident_analysis_service(
    :'first_incident_id'::uuid,
    :'first_lease_token'
) as released
\gset release_

select *
from public.v2_begin_ephemeral_incident_analysis_service(
    '45000000-0000-4000-8000-000000000001'::uuid,
    '75000000-0000-4000-8000-000000000001'::uuid,
    'exclusion'::text,
    'high'::text,
    'target'::text,
    0.9::real,
    0.95::real,
    date_trunc('milliseconds', now() - interval '1 minute'),
    2::smallint,
    3::smallint,
    7::bigint,
    1::integer,
    2::smallint,
    date_trunc('milliseconds', now() + interval '1 day'),
    repeat('ab', 32),
    120::integer
)
\gset retry_

select *
from public.v2_finalize_ephemeral_incident_analysis_service(
    :'retry_incident_id'::uuid,
    :'retry_lease_token',
    'confirmed',
    'exclusion_pattern',
    'professional_support',
    'gpt-5.6-luna',
    'exclusion',
    array[]::text[],
    'high',
    'elevated',
    'target',
    'repeated',
    0.91::real,
    array['AAAAAAAAAAAAAAAAAAAAAA']::text[],
    array['in_app', 'push']::text[]
)
\gset final_

reset role;

select case
    when :'busy_analysis_state' = 'busy'
     and :'release_released'::boolean is true
     and :'retry_analysis_state' = 'leased'
     and :'retry_lease_token' <> :'first_lease_token'
     and :'final_analysis_outcome' = 'confirmed'
    then true
    else pg_temp.assert_false(
        true,
        'Ephemeral lease lifecycle failed'
    )
end;

select case
    when exists (
        select 1
        from public.v2_incident_analysis analysis
        where analysis.incident_id = :'first_incident_id'::uuid
          and analysis.outcome = 'confirmed'
          and analysis.safe_summary is not null
          and analysis.safe_reason is not null
          and analysis.recommended_action is not null
          and analysis.prompt_version = 'kippy-expert-v4'
    ) then true
    else pg_temp.assert_false(
        true,
        'Parent-safe analysis and guidance were not persisted'
    )
end;

select case
    when exists (
        select 1
        from public.v2_incident_analysis_details details
        where details.incident_id = :'first_incident_id'::uuid
          and details.expert_category = 'exclusion'
          and details.inference_contract_version = 3
          and details.evidence_segment_refs =
                array['AAAAAAAAAAAAAAAAAAAAAA']::text[]
    ) then true
    else pg_temp.assert_false(
        true,
        'Structured expert result was not persisted'
    )
end;

select case
    when (
        select count(*)
        from public.v2_alert_deliveries delivery
        where delivery.incident_id = :'first_incident_id'::uuid
    ) = 2 then true
    else pg_temp.assert_false(
        true,
        'Expected in-app and push alert intents'
    )
end;

select pg_temp.assert_false(
    exists (
        select 1
        from public.v2_incident_context context
        where context.incident_id = :'first_incident_id'::uuid
    ),
    'Raw context appeared after finalization'
);

select case
    when not has_table_privilege(
        'authenticated',
        'public.v2_ephemeral_incident_receipts',
        'SELECT'
    ) then true
    else pg_temp.assert_false(
        true,
        'Authenticated role can read internal ephemeral receipts'
    )
end;

rollback;
