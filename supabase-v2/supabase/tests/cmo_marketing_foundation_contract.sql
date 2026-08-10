-- Disposable database contract only. All synthetic fixtures are rolled back.
begin;

do $$
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

set local role anon;
select set_config(
    'test.waitlist_id',
    public.v2_submit_marketing_waitlist(
        'Runtime Parent', 'runtime-contract@example.com', '050-123 4567',
        11::smallint, 'Android', 'center', 'search', null::text,
        jsonb_build_object('utm_source', 'founder', 'landing_path', '/runtime-first'),
        jsonb_build_object('utm_source', 'search', 'landing_path', '/runtime-submit'),
        '/runtime-submit', 'example.com', 'waitlist-updates-v1'
    )::text,
    true
);
do $$
begin
    begin
        perform public.v2_submit_marketing_waitlist(
            'Runtime Parent', ' runtime-contract@example.com ', '0501234567',
            11::smallint, 'android', 'center', 'search', null::text,
            jsonb_build_object('landing_path', '/runtime-first'),
            jsonb_build_object('landing_path', '/runtime-submit'),
            '/runtime-submit', 'example.com', 'waitlist-updates-v1'
        );
        raise exception 'expected_duplicate_waitlist_denial';
    exception when unique_violation then
        if sqlerrm <> 'waitlist_signup_exists' then raise; end if;
        raise notice 'PASS duplicate waitlist signup denied';
    end;
    begin
        perform public.v2_submit_marketing_waitlist(
            'Other Parent', 'other-runtime@example.com', '0501234568',
            11::smallint, 'android', 'center', 'search', null::text,
            jsonb_build_object('landing_path', '/', 'unexpected', 'x'),
            jsonb_build_object('landing_path', '/'),
            '/', 'example.com', 'waitlist-updates-v1'
        );
        raise exception 'expected_invalid_attribution_denial';
    exception when invalid_parameter_value then
        if sqlerrm <> 'invalid_waitlist_payload' then raise; end if;
        raise notice 'PASS invalid waitlist attribution denied';
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
end;
$$;
reset role;

do $$
declare
    signup public.v2_marketing_waitlist_signups%rowtype;
begin
    select * into signup
      from public.v2_marketing_waitlist_signups
     where id = current_setting('test.waitlist_id')::uuid;
    if signup.email <> 'runtime-contract@example.com'
       or signup.phone <> '0501234567'
       or signup.device_os <> 'android'
       or signup.first_touch->>'utm_source' <> 'founder'
       or signup.submission_touch->>'utm_source' <> 'search' then
        raise exception 'waitlist_normalization_or_attribution_failed';
    end if;
    raise notice 'PASS anon waitlist RPC and attribution';
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
