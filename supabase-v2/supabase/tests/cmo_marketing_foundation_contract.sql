-- Disposable database contract only. All synthetic fixtures are rolled back.
begin;

do $$
declare
    waitlist_proc regprocedure :=
        'public.v2_submit_marketing_waitlist(text,text,text,smallint,text,text,text,text,jsonb,jsonb,text,text,text)'::regprocedure;
begin
    if not exists (
        select 1
          from public.v2_staff_role_permissions
         where role_key = 'ceo'
           and permission_key = 'marketing.approve'
    ) or not exists (
        select 1
          from public.v2_staff_role_permissions
         where role_key = 'growth_product_data'
           and permission_key = 'marketing.manage'
    ) or not exists (
        select 1
          from public.v2_staff_role_permissions
         where role_key = 'auditor'
           and permission_key = 'marketing.read'
    ) then
        raise exception 'marketing_role_seed_missing';
    end if;
    if exists (
        select 1
          from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname in (
               'v2_cmo_create_campaign_brief',
               'v2_cmo_create_content_item',
               'v2_cmo_record_claim_review',
               'v2_cmo_request_content_approval',
               'v2_cmo_decide_content_approval',
               'v2_cmo_create_publication_intent',
               'v2_cmo_list_pending_approvals'
           )
           and has_function_privilege('anon', oid, 'EXECUTE')
    ) then
        raise exception 'anon_cmo_execute_grant_present';
    end if;
    if not exists (
        select 1
          from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = 'v2_cmo_list_pending_approvals'
           and provolatile = 'v'
    ) then
        raise exception 'pending_approvals_rpc_must_be_volatile';
    end if;
    if has_function_privilege('anon', waitlist_proc, 'EXECUTE')
       or has_function_privilege('authenticated', waitlist_proc, 'EXECUTE')
       or not has_function_privilege('service_role', waitlist_proc, 'EXECUTE') then
        raise exception 'waitlist_execute_acl_failed';
    end if;
    if exists (
        select 1
          from pg_proc target_proc
         where target_proc.oid = waitlist_proc
           and (
               not target_proc.prosecdef
               or not exists (
                   select 1 from unnest(target_proc.proconfig) setting
                    where setting = 'search_path=""'
               )
               or exists (
                   select 1
                     from aclexplode(coalesce(
                         target_proc.proacl,
                         acldefault('f', target_proc.proowner)
                     )) acl_entry
                    where acl_entry.grantee = 0
                      and acl_entry.privilege_type = 'EXECUTE'
               )
           )
    ) then
        raise exception 'waitlist_function_security_contract_failed';
    end if;
    if exists (
        select 1
          from pg_class relation
         where relation.oid in (
               'public.v2_marketing_waitlist_signups'::regclass,
               'public.v2_marketing_waitlist_rate_limits'::regclass,
               'v2_private.v2_marketing_waitlist_rate_secrets'::regclass
           )
           and (not relation.relrowsecurity or not relation.relforcerowsecurity)
    ) then
        raise exception 'waitlist_force_rls_missing';
    end if;
    if exists (
        select 1
          from (values
              ('public.v2_marketing_waitlist_signups'),
              ('public.v2_marketing_waitlist_rate_limits'),
              ('v2_private.v2_marketing_waitlist_rate_secrets')
          ) target(table_name)
          cross join unnest(array[
              'anon','authenticated','service_role'
          ]) role_entry(role_name)
          cross join unnest(array[
              'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
          ]) privilege_entry(privilege_name)
         where has_table_privilege(
             role_entry.role_name,
             target.table_name,
             privilege_entry.privilege_name
         )
    ) then
        raise exception 'waitlist_direct_table_privilege_present';
    end if;
    if exists (
        select 1
          from unnest(array[
              'anon','authenticated','service_role'
          ]) role_entry(role_name)
         where has_schema_privilege(
                   role_entry.role_name, 'v2_private', 'USAGE'
               )
            or has_schema_privilege(
                   role_entry.role_name, 'v2_private', 'CREATE'
               )
    ) then
        raise exception 'waitlist_private_schema_privilege_present';
    end if;
    if public.v2_marketing_touch_is_valid(null::jsonb)
       or public.v2_marketing_touch_is_valid('[]'::jsonb)
       or public.v2_marketing_touch_is_valid('"scalar"'::jsonb) then
        raise exception 'waitlist_touch_shape_guard_failed';
    end if;
    if exists (
        select 1
          from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname in (
               'v2_cmo_create_campaign_brief',
               'v2_cmo_create_content_item',
               'v2_cmo_record_claim_review',
               'v2_cmo_request_content_approval',
               'v2_cmo_decide_content_approval',
               'v2_cmo_create_publication_intent',
               'v2_cmo_list_pending_approvals'
           )
           and (
               has_function_privilege('service_role', oid, 'EXECUTE')
               or not has_function_privilege('authenticated', oid, 'EXECUTE')
               or not prosecdef
               or not exists (
                   select 1 from unnest(proconfig) setting
                    where setting = 'search_path=""'
               )
           )
    ) then
        raise exception 'cmo_acl_security_contract_failed';
    end if;
end;
$$;

insert into auth.users (id) values
    ('00000000-0000-0000-0000-00000000ce01'),
    ('00000000-0000-0000-0000-00000000a101'),
    ('00000000-0000-0000-0000-00000000a201'),
    ('00000000-0000-0000-0000-00000000a301');

insert into public.v2_admin_principals (
    id, principal_type, principal_key, display_name, environment, status
) values
    ('10000000-0000-0000-0000-00000000c001', 'staff', 'cmo-ceo-test', 'CMO CEO test', 'staging', 'active'),
    ('10000000-0000-0000-0000-00000000a101', 'staff', 'cmo-growth-test', 'CMO Growth test', 'staging', 'active'),
    ('10000000-0000-0000-0000-00000000a201', 'staff', 'cmo-auditor-test', 'CMO Auditor test', 'staging', 'active'),
    ('10000000-0000-0000-0000-00000000a301', 'staff', 'cmo-unassigned-test', 'CMO Unassigned test', 'staging', 'active');

insert into public.v2_staff_profiles (principal_id, auth_user_id) values
    ('10000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000ce01'),
    ('10000000-0000-0000-0000-00000000a101', '00000000-0000-0000-0000-00000000a101'),
    ('10000000-0000-0000-0000-00000000a201', '00000000-0000-0000-0000-00000000a201'),
    ('10000000-0000-0000-0000-00000000a301', '00000000-0000-0000-0000-00000000a301');

insert into public.v2_staff_role_assignments (
    staff_principal_id, role_key, environment, scope_type, scope_key,
    granted_by_principal_id, reason_code
) values
    ('10000000-0000-0000-0000-00000000c001', 'ceo', 'staging', 'global', null, '10000000-0000-0000-0000-00000000c001', 'cmo-runtime-test'),
    ('10000000-0000-0000-0000-00000000a101', 'growth_product_data', 'staging', 'global', null, '10000000-0000-0000-0000-00000000c001', 'cmo-runtime-test'),
    ('10000000-0000-0000-0000-00000000a201', 'auditor', 'staging', 'global', null, '10000000-0000-0000-0000-00000000c001', 'cmo-runtime-test');

select set_config('request.headers', '{"x-real-ip":"198.51.100.10"}', true);
set local role service_role;
select set_config(
    'test.waitlist_ack',
    public.v2_submit_marketing_waitlist(
        'Runtime Parent', 'runtime-contract@example.com', '050-123 4567',
        11::smallint, 'Android', 'center', 'search', null::text,
        jsonb_build_object('utm_source', 'founder', 'landing_path', '/runtime-first'),
        jsonb_build_object('utm_source', 'search', 'landing_path', '/runtime-submit'),
        '/runtime-submit', 'example.com', 'caller-supplied-version'
    )::text,
    true
);
do $$
declare
    duplicate_id uuid;
begin
    duplicate_id := public.v2_submit_marketing_waitlist(
        'Runtime Parent', ' runtime-contract@example.com ', '0501234567',
        11::smallint, 'android', 'center', 'search', null::text,
        jsonb_build_object('landing_path', '/runtime-first'),
        jsonb_build_object('landing_path', '/runtime-submit'),
        '/runtime-submit', 'example.com', 'caller-supplied-version'
    );
    if duplicate_id is null
       or duplicate_id = current_setting('test.waitlist_ack')::uuid then
        raise exception 'duplicate_waitlist_response_not_opaque';
    end if;
    raise notice 'PASS duplicate waitlist response is generic and opaque';

    perform set_config(
        'test.default_waitlist_ack',
        public.v2_submit_marketing_waitlist(
            target_parent_name => 'Default Parent',
            target_email => 'default-contract@example.com',
            target_phone => '0501234568',
            target_child_age => 11::smallint,
            target_device_os => 'android'
        )::text,
        true
    );
end;
$$;
reset role;
delete from public.v2_marketing_waitlist_rate_limits;
set local role service_role;
do $$
declare
    i integer;
    acknowledgement_id uuid;
begin
    for i in 1..5 loop
        acknowledgement_id := public.v2_submit_marketing_waitlist(
            target_parent_name => format('Rate Parent %s', i),
            target_email => 'rate-identity@example.com',
            target_phone => '0501234010',
            target_child_age => 11::smallint,
            target_device_os => 'android'
        );
        if acknowledgement_id is null then
            raise exception 'waitlist_identity_ack_missing';
        end if;
    end loop;
end;
$$;
reset role;
delete from public.v2_marketing_waitlist_signups
 where email = 'rate-identity@example.com';
set local role service_role;
do $$
begin
    if public.v2_submit_marketing_waitlist(
        target_parent_name => 'Rate Parent Limited',
        target_email => 'rate-identity@example.com',
        target_phone => '0501234010',
        target_child_age => 11::smallint,
        target_device_os => 'android'
    ) is null then
        raise exception 'waitlist_limited_ack_missing';
    end if;
end;
$$;
reset role;
do $$
begin
    if exists (
        select 1
          from public.v2_marketing_waitlist_signups
         where email = 'rate-identity@example.com'
    ) or (
        select count(*)
          from public.v2_marketing_waitlist_rate_limits
         where submission_count = 6
    ) <> 3 then
        raise exception 'waitlist_hmac_identity_rate_limit_failed';
    end if;
    raise notice 'PASS HMAC email and phone rate limits return opaque acknowledgements';
end;
$$;

delete from public.v2_marketing_waitlist_rate_limits;
insert into public.v2_marketing_waitlist_rate_limits (
    rate_key, window_started_at, submission_count, updated_at
) values (
    repeat('f', 64), now() - interval '11 minutes', 1,
    now() - interval '11 minutes'
);
set local role service_role;
do $$
begin
    perform public.v2_submit_marketing_waitlist(
        target_parent_name => 'Stale Prune Parent',
        target_email => 'stale-prune@example.com',
        target_phone => '0501234580',
        target_child_age => 2::smallint,
        target_device_os => 'android'
    );
end;
$$;
reset role;
do $$
begin
    if exists (
        select 1
          from public.v2_marketing_waitlist_rate_limits
         where rate_key = repeat('f', 64)
    ) then
        raise exception 'waitlist_stale_rate_key_not_pruned';
    end if;
    raise notice 'PASS stale HMAC rate keys are pruned';
end;
$$;

delete from public.v2_marketing_waitlist_rate_limits;
insert into public.v2_marketing_waitlist_rate_limits (
    rate_key, window_started_at, submission_count, updated_at
)
select encode(
           extensions.hmac(
               convert_to('global:v1', 'utf8'), secret_value, 'sha256'
           ),
           'hex'
       ),
       now(),
       2147483647,
       now()
  from v2_private.v2_marketing_waitlist_rate_secrets
 where singleton;
set local role service_role;
do $$
begin
    perform public.v2_submit_marketing_waitlist(
        target_parent_name => 'Counter Cap Parent',
        target_email => 'counter-cap@example.com',
        target_phone => '0501234581',
        target_child_age => 11::smallint,
        target_device_os => 'android'
    );
end;
$$;
reset role;
do $$
begin
    if (
        select submission_count
          from public.v2_marketing_waitlist_rate_limits
    ) <> 2147483647 then
        raise exception 'waitlist_rate_counter_cap_failed';
    end if;
    raise notice 'PASS rate counter is capped without overflow';
end;
$$;

delete from public.v2_marketing_waitlist_rate_limits;
set local role service_role;
do $$
declare
    i integer;
    acknowledgement_id uuid;
begin
    for i in 1..5 loop
        acknowledgement_id := public.v2_submit_marketing_waitlist(
            target_parent_name => 'Invalid Rate Parent',
            target_email => 'invalid-rate@example.com',
            target_phone => '0501234020',
            target_child_age => 2::smallint,
            target_device_os => 'android'
        );
        if acknowledgement_id is null then
            raise exception 'waitlist_invalid_ack_missing';
        end if;
    end loop;
    acknowledgement_id := public.v2_submit_marketing_waitlist(
        target_parent_name => 'Now Valid Parent',
        target_email => 'invalid-rate@example.com',
        target_phone => '0501234020',
        target_child_age => 11::smallint,
        target_device_os => 'android'
    );
    if acknowledgement_id is null then
        raise exception 'waitlist_invalid_rate_limited_ack_missing';
    end if;
end;
$$;
reset role;
do $$
begin
    if exists (
        select 1
          from public.v2_marketing_waitlist_signups
         where email = 'invalid-rate@example.com'
    ) or (
        select count(*)
          from public.v2_marketing_waitlist_rate_limits
         where submission_count = 6
    ) <> 3 then
        raise exception 'waitlist_invalid_traffic_not_bounded';
    end if;
    raise notice 'PASS invalid traffic is counted and rejected generically';
end;
$$;

delete from public.v2_marketing_waitlist_rate_limits;
set local role service_role;
do $$
declare
    i integer;
    acknowledgement_id uuid;
begin
    for i in 1..300 loop
        acknowledgement_id := public.v2_submit_marketing_waitlist(
            target_parent_name => 'Global Circuit Parent',
            target_email => format('global-rate-%s@example.com', i),
            target_phone => '05' || lpad(i::text, 8, '0'),
            target_child_age => 2::smallint,
            target_device_os => 'android'
        );
        if acknowledgement_id is null then
            raise exception 'waitlist_global_ack_missing:%', i;
        end if;
    end loop;
    acknowledgement_id := public.v2_submit_marketing_waitlist(
        target_parent_name => 'Global Circuit Accepted Shape',
        target_email => 'global-rate-301@example.com',
        target_phone => '0500000301',
        target_child_age => 11::smallint,
        target_device_os => 'android'
    );
    if acknowledgement_id is null then
        raise exception 'waitlist_global_limited_ack_missing';
    end if;
end;
$$;
reset role;
do $$
begin
    if exists (
        select 1
          from public.v2_marketing_waitlist_signups
         where email like 'global-rate-%@example.com'
    ) or (
        select count(*)
          from public.v2_marketing_waitlist_rate_limits
         where submission_count = 301
    ) <> 1 then
        raise exception 'waitlist_global_emergency_limit_failed';
    end if;
    raise notice 'PASS high global emergency circuit breaker is generic';
end;
$$;

delete from public.v2_marketing_waitlist_rate_limits;
set local role service_role;
do $$
declare
    invalid_acknowledgement_id uuid;
begin
    invalid_acknowledgement_id := public.v2_submit_marketing_waitlist(
        'Other Parent', 'other-runtime@example.com', '0501234569',
        11::smallint, 'android', 'center', 'search', null::text,
        jsonb_build_object('landing_path', '/', 'unexpected', 'x'),
        jsonb_build_object('landing_path', '/'),
        '/', 'example.com', 'waitlist-updates-v1'
    );
    if invalid_acknowledgement_id is null then
        raise exception 'invalid_waitlist_attribution_ack_missing';
    end if;
    if public.v2_submit_marketing_waitlist(
        target_parent_name => 'Scalar Touch Parent',
        target_email => 'invalid-shape-scalar@example.com',
        target_phone => '0501234570',
        target_child_age => 11::smallint,
        target_device_os => 'android',
        target_first_touch => '"scalar"'::jsonb
    ) is null
       or public.v2_submit_marketing_waitlist(
        target_parent_name => 'Array Touch Parent',
        target_email => 'invalid-shape-array@example.com',
        target_phone => '0501234571',
        target_child_age => 11::smallint,
        target_device_os => 'android',
        target_first_touch => '[]'::jsonb
    ) is null
       or public.v2_submit_marketing_waitlist(
        target_parent_name => 'Null Touch Parent',
        target_email => 'invalid-shape-null@example.com',
        target_phone => '0501234572',
        target_child_age => 11::smallint,
        target_device_os => 'android',
        target_first_touch => null::jsonb
    ) is null
       or public.v2_submit_marketing_waitlist(
        target_parent_name => 'Unsafe Email Parent',
        target_email => '<x>@example.com',
        target_phone => '0501234573',
        target_child_age => 11::smallint,
        target_device_os => 'android'
    ) is null
       or public.v2_submit_marketing_waitlist(
        target_parent_name => 'Unsafe Referral Parent',
        target_email => 'invalid-referral@example.com',
        target_phone => '0501234574',
        target_child_age => 11::smallint,
        target_device_os => 'android',
        target_referral_source => 'other',
        target_referral_other => '<script>'
    ) is null then
        raise exception 'invalid_waitlist_generic_ack_missing';
    end if;
    raise notice 'PASS malformed attribution and unsafe text rejected generically';
end;
$$;
reset role;

do $$
begin
    if exists (
        select 1
          from public.v2_marketing_waitlist_signups
         where email in (
             'other-runtime@example.com',
             'invalid-shape-scalar@example.com',
             'invalid-shape-array@example.com',
             'invalid-shape-null@example.com',
             '<x>@example.com',
             'invalid-referral@example.com'
         )
    ) then
        raise exception 'invalid_waitlist_payload_persisted';
    end if;
end;
$$;

set local role anon;
do $$
begin
    begin
        perform public.v2_submit_marketing_waitlist(
            target_parent_name => 'Denied Browser Parent',
            target_email => 'denied-browser@example.com',
            target_phone => '0501234599',
            target_child_age => 11::smallint,
            target_device_os => 'android'
        );
        raise exception 'expected_anon_waitlist_rpc_denial';
    exception when insufficient_privilege then
        raise notice 'PASS anon direct waitlist RPC denied';
    end;
    begin
        perform count(*) from public.v2_marketing_waitlist_signups;
        raise exception 'expected_anon_table_denial';
    exception when insufficient_privilege then
        raise notice 'PASS anon direct waitlist select denied';
    end;
    begin
        perform public.v2_cmo_list_pending_approvals(5);
        raise exception 'expected_anon_cmo_denial';
    exception when insufficient_privilege then
        raise notice 'PASS anon CMO RPC denied';
    end;
    begin
        perform count(*) from public.v2_marketing_waitlist_rate_limits;
        raise exception 'expected_anon_rate_limit_table_denial';
    exception when insufficient_privilege then
        raise notice 'PASS anon rate-limit table denied';
    end;
    begin
        perform count(*)
          from v2_private.v2_marketing_waitlist_rate_secrets;
        raise exception 'expected_anon_rate_secret_denial';
    exception when insufficient_privilege then
        raise notice 'PASS anon rate secret denied';
    end;
end;
$$;
reset role;

do $$
declare
    signup public.v2_marketing_waitlist_signups%rowtype;
begin
    select * into signup
      from public.v2_marketing_waitlist_signups
     where email = 'runtime-contract@example.com';
    if signup.email <> 'runtime-contract@example.com'
       or signup.phone <> '0501234567'
       or signup.device_os <> 'android'
       or signup.first_touch->>'utm_source' <> 'founder'
       or signup.submission_touch->>'utm_source' <> 'search'
       or signup.marketing_notice_version <> 'waitlist-updates-v1'
       or signup.id = current_setting('test.waitlist_ack')::uuid
       or (
           select count(*)
             from public.v2_marketing_waitlist_signups
            where email = 'runtime-contract@example.com'
       ) <> 1 then
        raise exception 'waitlist_normalization_or_attribution_failed';
    end if;
    select * into signup
      from public.v2_marketing_waitlist_signups
     where email = 'default-contract@example.com';
    if signup.first_touch->>'landing_path' <> '/'
       or signup.submission_touch->>'landing_path' <> '/'
       or signup.marketing_notice_version <> 'waitlist-updates-v1'
       or signup.id = current_setting('test.default_waitlist_ack')::uuid then
        raise exception 'waitlist_defaults_or_server_notice_failed';
    end if;
    raise notice 'PASS service-role waitlist RPC and attribution';
end;
$$;

set local role authenticated;
do $$
begin
    begin
        perform public.v2_cmo_create_campaign_brief('o', 'a', 'PRELAUNCH', 'WEBSITE', 'h', 'cta');
        raise exception 'expected_no_session_denial';
    exception when insufficient_privilege then
        if sqlerrm not like 'marketing_permission_denied:%' then raise; end if;
        raise notice 'PASS no-session denied';
    end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ce01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ce01","aal":"aal1"}', true);
do $$
begin
    begin
        perform public.v2_cmo_create_campaign_brief('o', 'a', 'PRELAUNCH', 'WEBSITE', 'h', 'cta');
        raise exception 'expected_aal1_denial';
    exception when insufficient_privilege then
        if sqlerrm not like 'marketing_permission_denied:%' then raise; end if;
        raise notice 'PASS AAL1 denied';
    end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a301', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a301","aal":"aal2"}', true);
do $$
begin
    begin
        perform public.v2_cmo_create_campaign_brief('o', 'a', 'PRELAUNCH', 'WEBSITE', 'h', 'cta');
        raise exception 'expected_missing_permission_denial';
    exception when insufficient_privilege then
        if sqlerrm not like 'marketing_permission_denied:%' then raise; end if;
        raise notice 'PASS missing permission denied';
    end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","aal":"aal2"}', true);
select set_config(
    'test.brief_id',
    public.v2_cmo_create_campaign_brief(
        'Runtime objective', 'Runtime audience', 'PRELAUNCH', 'WEBSITE',
        'Runtime hypothesis', 'Join updates'
    )::text,
    true
);
select set_config(
    'test.content_id',
    public.v2_cmo_create_content_item(
        current_setting('test.brief_id')::uuid, 'landing-copy',
        jsonb_build_object('body', 'Runtime copy'), repeat('a', 64),
        '[]'::jsonb, jsonb_build_array('claim-a'), '{}'::jsonb
    )::text,
    true
);
select public.v2_cmo_record_claim_review(
    current_setting('test.content_id')::uuid,
    repeat('a', 64), 'PASS', jsonb_build_array('claim-a')
);

select set_config(
    'test.mismatch_content_id',
    public.v2_cmo_create_content_item(
        current_setting('test.brief_id')::uuid, 'landing-copy',
        jsonb_build_object('body', 'Mismatch copy'), repeat('c', 64),
        '[]'::jsonb, jsonb_build_array('claim-b'), '{}'::jsonb
    )::text,
    true
);
do $$
begin
    begin
        perform public.v2_cmo_record_claim_review(
            current_setting('test.mismatch_content_id')::uuid,
            repeat('c', 64), 'PASS', jsonb_build_array('claim-c')
        );
        raise exception 'expected_claim_refs_mismatch';
    exception when check_violation then
        if sqlerrm <> 'claim_refs_mismatch_for_content_hash' then raise; end if;
        raise notice 'PASS changed claim_refs rejected explicitly';
    end;
end;
$$;

reset role;
do $$
declare
    matched public.v2_cmo_content_items%rowtype;
    mismatched public.v2_cmo_content_items%rowtype;
begin
    select * into matched
      from public.v2_cmo_content_items
     where id = current_setting('test.content_id')::uuid;
    select * into mismatched
      from public.v2_cmo_content_items
     where id = current_setting('test.mismatch_content_id')::uuid;
    if matched.claim_refs <> jsonb_build_array('claim-a')
       or matched.claim_gate_result <> 'PASS'
       or matched.claim_reviewed_at is null then
        raise exception 'matching_claim_review_failed';
    end if;
    if mismatched.claim_refs <> jsonb_build_array('claim-b')
       or mismatched.claim_gate_result <> 'REVISE'
       or mismatched.claim_reviewed_at is not null then
        raise exception 'mismatched_claim_review_mutated_content';
    end if;
    raise notice 'PASS claim review is verification-only';
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a101","aal":"aal2"}', true);
select set_config(
    'test.approval_id',
    public.v2_cmo_request_content_approval(
        current_setting('test.content_id')::uuid, repeat('a', 64),
        jsonb_build_object('body', 'Runtime copy'), 'LOW', '{}'::jsonb,
        '[]'::jsonb, now() + interval '2 hours'
    )::text,
    true
);
do $$
begin
    begin
        perform public.v2_cmo_decide_content_approval(
            current_setting('test.approval_id')::uuid, 'APPROVED', repeat('a', 64), null
        );
        raise exception 'expected_growth_approval_denial';
    exception when insufficient_privilege then
        if sqlerrm not like 'marketing_permission_denied:marketing.approve%' then raise; end if;
        raise notice 'PASS growth approval denied';
    end;
    begin
        perform public.v2_cmo_create_publication_intent(
            'CONTENT_ITEM', current_setting('test.content_id')::uuid, 'WEBSITE',
            current_setting('test.approval_id')::uuid, repeat('a', 64),
            'runtime-contract-key-001', null
        );
        raise exception 'expected_growth_publication_denial';
    exception when insufficient_privilege then
        if sqlerrm not like 'marketing_permission_denied:marketing.publish_intent%' then raise; end if;
        raise notice 'PASS growth publication intent denied';
    end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a201', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a201","aal":"aal2"}', true);
do $$
declare
    pending_count integer;
begin
    select count(*) into pending_count
      from public.v2_cmo_list_pending_approvals(10);
    if pending_count <> 1 then
        raise exception 'auditor_pending_count:%', pending_count;
    end if;
    raise notice 'PASS auditor can list pending approval';
end;
$$;
do $$
begin
    begin
        perform public.v2_cmo_create_campaign_brief('o2', 'a', 'PRELAUNCH', 'WEBSITE', 'h', 'cta');
        raise exception 'expected_auditor_manage_denial';
    exception when insufficient_privilege then
        if sqlerrm not like 'marketing_permission_denied:marketing.manage%' then raise; end if;
        raise notice 'PASS auditor manage denied';
    end;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ce01', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ce01","aal":"aal2"}', true);
select public.v2_cmo_decide_content_approval(
    current_setting('test.approval_id')::uuid,
    'APPROVED', repeat('a', 64), 'Runtime approved'
);
select set_config(
    'test.job_id',
    public.v2_cmo_create_publication_intent(
        'CONTENT_ITEM', current_setting('test.content_id')::uuid, 'WEBSITE',
        current_setting('test.approval_id')::uuid, repeat('a', 64),
        'runtime-contract-key-001', null
    )::text,
    true
);
select set_config(
    'test.replay_job_id',
    public.v2_cmo_create_publication_intent(
        'CONTENT_ITEM', current_setting('test.content_id')::uuid, 'WEBSITE',
        current_setting('test.approval_id')::uuid, repeat('a', 64),
        'runtime-contract-key-001', null
    )::text,
    true
);
do $$
begin
    if current_setting('test.job_id')::uuid <>
       current_setting('test.replay_job_id')::uuid then
        raise exception 'publication_idempotent_replay_changed_id';
    end if;
    begin
        perform public.v2_cmo_create_publication_intent(
            'CONTENT_ITEM', current_setting('test.content_id')::uuid, 'FOUNDER',
            current_setting('test.approval_id')::uuid, repeat('a', 64),
            'runtime-contract-key-001', null
        );
        raise exception 'expected_publication_idempotency_conflict';
    exception when unique_violation then
        if sqlerrm <> 'publication_idempotency_conflict' then raise; end if;
        raise notice 'PASS publication idempotency';
    end;
end;
$$;

reset role;
update public.v2_cmo_content_items
   set copy_json = jsonb_build_object('body', 'Runtime copy changed'),
       content_hash = repeat('b', 64)
 where id = current_setting('test.content_id')::uuid;

do $$
declare
    item public.v2_cmo_content_items%rowtype;
    approval public.v2_cmo_approval_requests%rowtype;
    job public.v2_cmo_publication_jobs%rowtype;
    audit_id bigint;
begin
    select * into item from public.v2_cmo_content_items where id = current_setting('test.content_id')::uuid;
    select * into approval from public.v2_cmo_approval_requests where id = current_setting('test.approval_id')::uuid;
    select * into job from public.v2_cmo_publication_jobs where id = current_setting('test.job_id')::uuid;
    if item.status <> 'POLICY_REVIEW'
       or item.claim_gate_result <> 'REVISE'
       or item.claim_reviewed_at is not null
       or approval.status <> 'CANCELLED'
       or job.status <> 'CANCELLED'
       or job.failure_code <> 'CONTENT_CHANGED' then
        raise exception 'content_hash_invalidation_failed';
    end if;
    raise notice 'PASS content hash invalidation';

    select min(id) into audit_id from public.v2_cmo_audit_events;
    begin
        update public.v2_cmo_audit_events set payload = '{"tampered":true}'::jsonb where id = audit_id;
        raise exception 'expected_append_only_update_denial';
    exception when others then
        if sqlerrm = 'expected_append_only_update_denial' then raise; end if;
    end;
    begin
        delete from public.v2_cmo_audit_events where id = audit_id;
        raise exception 'expected_append_only_delete_denial';
    exception when others then
        if sqlerrm = 'expected_append_only_delete_denial' then raise; end if;
    end;
    raise notice 'PASS append-only audit';
end;
$$;

select 'CMO marketing foundation runtime contract: PASS';
rollback;
