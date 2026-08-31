-- Disposable database contract only. All synthetic fixtures are rolled back.
begin;

do $$
declare
    target_job_id uuid := '6f000000-0000-4000-8000-000000000001';
    target_case_id uuid := '6f000000-0000-4000-8000-000000000002';
    valid_result jsonb;
    valid_handoff jsonb;
    malicious_result jsonb;
    forbidden_case record;
begin
    valid_handoff := jsonb_build_object(
        'handoff_id', 'handoff-contract-001',
        'handoff_kind', 'agent_assignment',
        'to', jsonb_build_object('kind', 'agent', 'agent_id', 'support'),
        'reason_code', 'contract_review',
        'delivery_status', 'not_dispatched',
        'effect_mode', 'proposal_only',
        'authorization_state', 'not_authorized',
        'signed_assignment', 'false',
        'reauthorization_required', 'true',
        'approval_required', 'true',
        'case_id', target_case_id::text
    );

    valid_result := jsonb_build_object(
        'schema_version', '1',
        'contract_version', 'ct-agent-contract-v1',
        'execution_mode', 'offline_shadow',
        'effect_mode', 'proposals_only',
        'routing', jsonb_build_object(
            'job_id', target_job_id::text,
            'case_id', target_case_id::text,
            'effect_mode', 'none',
            'decision_code', 'shadow.completed'
        ),
        'run_record', jsonb_build_object(
            'job_id', target_job_id::text,
            'case_id', target_case_id::text,
            'execution_mode', 'offline_shadow',
            'effect_mode', 'proposals_only',
            'model_used', 'false',
            'network_used', 'false',
            'tools_executed', '0',
            'mutations_applied', '0',
            'outbound_messages_sent', '0',
            'status', 'completed_shadow',
            'agent_id', 'support',
            'run_id', 'run-contract-001',
            'registry_version', 'ct-agent-registry-v1',
            'orchestrator_version', 'ct-agent-orchestrator-v1'
        ),
        'handoffs', jsonb_build_array(valid_handoff),
        'tool_invocation_requests', jsonb_build_array(jsonb_build_object(
            'request_id', 'request-contract-001',
            'tool_name', 'contract-lookup',
            'access_mode', 'read_only',
            'authorization_state', 'not_authorized',
            'delegation_present', 'false',
            'reauthorization_required', 'true',
            'approval_state', 'required',
            'kill_switch_state', 'closed',
            'execution_status', 'proposed_not_executed',
            'effect_mode', 'proposal_only'
        )),
        'tool_invocation_results', jsonb_build_array(jsonb_build_object(
            'request_id', 'request-contract-001',
            'status', 'not_executed',
            'effect_mode', 'proposal_only',
            'result_code', 'not_executed'
        )),
        'case_transitions', jsonb_build_array(jsonb_build_object(
            'transition_id', 'transition-contract-001',
            'target_status', 'waiting_for_human',
            'reason_code', 'contract_review',
            'requires_human_approval', 'true',
            'apply_status', 'not_applied',
            'effect_mode', 'proposal_only'
        )),
        'memory_write_candidates', jsonb_build_array(jsonb_build_object(
            'candidate_id', 'memory-contract-001',
            'memory_kind', 'case_summary',
            'reason_code', 'contract_review',
            'requires_human_review', 'true',
            'write_status', 'candidate_not_written',
            'effect_mode', 'proposal_only'
        )),
        'human_takeover_requests', jsonb_build_array(jsonb_build_object(
            'request_id', 'takeover-contract-001',
            'queue', 'support',
            'reason_code', 'contract_review',
            'dispatch_status', 'not_dispatched',
            'effect_mode', 'proposal_only'
        ))
    );

    if not public.v2_admin_valid_shadow_result(
        valid_result, target_job_id, target_case_id
    ) then
        raise exception 'valid_shadow_result_rejected';
    end if;

    for forbidden_case in
        select * from (values
            (array['routing']::text[], 'content'),
            (array['run_record']::text[], 'prompt'),
            (array['handoffs','0']::text[], 'content'),
            (array['handoffs','0','to']::text[], 'excerpt'),
            (array['tool_invocation_requests','0']::text[], 'prompt'),
            (array['tool_invocation_results','0']::text[], 'content'),
            (array['case_transitions','0']::text[], 'transcript'),
            (array['memory_write_candidates','0']::text[], 'content'),
            (array['human_takeover_requests','0']::text[], 'messages')
        ) rejected(target_path, forbidden_key)
    loop
        malicious_result := jsonb_set(
            valid_result,
            forbidden_case.target_path,
            (valid_result #> forbidden_case.target_path) || jsonb_build_object(
                forbidden_case.forbidden_key,
                'raw child/support content must never persist'
            ),
            false
        );
        if public.v2_admin_valid_shadow_result(
            malicious_result, target_job_id, target_case_id
        ) then
            raise exception 'nested_shadow_key_was_accepted:%',
                forbidden_case.forbidden_key;
        end if;
    end loop;

    if public.v2_admin_valid_shadow_result(
        valid_result #- '{handoffs,0,handoff_kind}',
        target_job_id,
        target_case_id
    ) or public.v2_admin_valid_shadow_result(
        valid_result #- '{handoffs,0,to,kind}',
        target_job_id,
        target_case_id
    ) then
        raise exception 'missing_required_handoff_field_was_accepted';
    end if;

    malicious_result := jsonb_set(
        valid_result,
        '{handoffs,0}',
        (valid_result #> '{handoffs,0}') || jsonb_build_object(
            'content', 'raw child/support content must never persist'
        ),
        false
    );
    perform set_config(
        'test.malicious_shadow_result', malicious_result::text, true
    );
end;
$$;

insert into public.v2_support_contacts (
    id, environment, contact_kind, contact_hash, display_label_redacted
) values (
    '6f000000-0000-4000-8000-000000000010',
    'staging', 'prospect', repeat('6f', 32), 'shadow-contract'
);

insert into public.v2_support_channel_identities (
    id, environment, contact_id, channel, provider_account_key,
    provider_identity_hash, display_identity_redacted
) values (
    '6f000000-0000-4000-8000-000000000011',
    'staging', '6f000000-0000-4000-8000-000000000010', 'web',
    repeat('7a', 32), repeat('8b', 32), 'shadow-contract-web'
);

insert into public.v2_support_conversations (
    id, environment, source_mode, channel_identity_id, channel
) values (
    '6f000000-0000-4000-8000-000000000012',
    'staging', 'staging', '6f000000-0000-4000-8000-000000000011', 'web'
);

insert into public.v2_support_messages (
    id, environment, conversation_id, direction, message_type, ingest_status
) values (
    '6f000000-0000-4000-8000-000000000013',
    'staging', '6f000000-0000-4000-8000-000000000012',
    'inbound', 'text', 'persisted'
);

insert into public.v2_admin_cases (
    id, environment, source_mode, domain_key, category_key, intent_key,
    priority, queue_key, purpose_code, sensitivity, privacy_class,
    verification_level
) values (
    '6f000000-0000-4000-8000-000000000002',
    'staging', 'staging', 'support', 'contract', 'privacy_review',
    's2', 'support', 'shadow_contract', 'restricted', 'parent_safe',
    'v0_unknown'
);

insert into public.v2_admin_shadow_jobs (
    id, environment, channel_mode, message_id, case_id, status,
    attempt_count, max_attempts, leased_by, lease_token, leased_at,
    lease_expires_at
) values (
    '6f000000-0000-4000-8000-000000000001',
    'staging', 'shadow', '6f000000-0000-4000-8000-000000000013',
    '6f000000-0000-4000-8000-000000000002', 'leased',
    1, 3, 'privacy-contract', '6f000000-0000-4000-8000-000000000003',
    now(), now() + interval '5 minutes'
);

set local role service_role;
do $$
begin
    begin
        perform public.v2_admin_complete_shadow_job_service(
            '6f000000-0000-4000-8000-000000000001',
            '6f000000-0000-4000-8000-000000000003',
            current_setting('test.malicious_shadow_result')::jsonb
        );
        raise exception 'expected_invalid_shadow_result';
    exception when invalid_parameter_value then
        if sqlerrm <> 'invalid_shadow_result' then raise; end if;
        raise notice 'PASS raw nested shadow result rejected before persistence';
    end;
end;
$$;
reset role;

do $$
declare
    job_state text;
    persisted_lease_token uuid;
begin
    if exists (
        select 1 from public.v2_admin_agent_runs
         where job_id = '6f000000-0000-4000-8000-000000000001'
    ) or exists (
        select 1 from public.v2_admin_agent_handoffs
         where case_id = '6f000000-0000-4000-8000-000000000002'
    ) or exists (
        select 1
          from public.v2_admin_agent_evaluations evaluation
          join public.v2_admin_agent_runs run on run.id = evaluation.run_id
         where run.job_id = '6f000000-0000-4000-8000-000000000001'
    ) then
        raise exception 'invalid_shadow_result_persisted';
    end if;

    select status, lease_token
      into strict job_state, persisted_lease_token
      from public.v2_admin_shadow_jobs
     where id = '6f000000-0000-4000-8000-000000000001';
    if job_state is distinct from 'leased'
       or persisted_lease_token is distinct from
          '6f000000-0000-4000-8000-000000000003'::uuid then
        raise exception 'invalid_shadow_result_mutated_job';
    end if;
end;
$$;

select 'V2 shadow result privacy contract: PASS';

rollback;
