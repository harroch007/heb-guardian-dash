-- Metadata-only fixtures. No message text or provider calls. Always rolled back.
begin;
do $$ begin
  if current_database()<>'kippy_three_gate' or inet_server_addr()<>'127.0.0.1'::inet
    or inet_server_port()<>57439 then raise exception 'disposable_database_required'; end if;
end $$;
create function pg_temp.review_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'review assertion: %',label; end if; end;
$$;
create function pg_temp.review_id(prefix text,n integer) returns uuid language sql as $$
  select (prefix||'150000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
$$;
insert into public.v2_families(id,display_name) values(pg_temp.review_id('22',1),'Contract fixture');
insert into public.v2_children(id,family_id,display_name) values
  (pg_temp.review_id('33',1),pg_temp.review_id('22',1),'Contract fixture'),
  (pg_temp.review_id('33',2),pg_temp.review_id('22',1),'Other contract fixture');
insert into public.v2_protected_devices(id,child_id,installation_id,app_version,status) values
  (pg_temp.review_id('44',1),pg_temp.review_id('33',1),pg_temp.review_id('55',1),'review-contract','active'),
  (pg_temp.review_id('44',2),pg_temp.review_id('33',2),pg_temp.review_id('55',2),'review-contract','active');
create function pg_temp.review_reserve(n integer) returns table(incident_id uuid,lease_token text) language plpgsql as $$
begin
  return query select b.incident_id,b.lease_token from public.v2_begin_three_gate_assessment_service(pg_temp.review_id('44',1),
    jsonb_build_object('target_device_id',pg_temp.review_id('44',1),'target_client_incident_id',pg_temp.review_id('77',n),
      'target_category','other','target_severity','low','target_child_role','unknown','target_confidence',0,
      'target_capture_quality',0.9,'target_occurred_at',now(),'target_model_contract_version',2,
      'target_privacy_contract_version',3,'target_privacy_identity_version',1,'target_key_version',1,'target_message_count',2,
      'target_context_expires_at',now()+interval '1 hour','target_submission_hash_hex',repeat('a',64),'target_lease_seconds',120),
    jsonb_build_object('contract_version','MODERATION_CONTEXT_FIFO_V1','case_id',pg_temp.review_id('66',n),
      'assessment_id',pg_temp.review_id('77',n),'assessment_seq',1,'previous_assessment_id',null,'origin_evidence_available',false,
      'digest_algorithm','HMAC_SHA256_JSON_BINARY_V1','payload_digest',repeat('b',64),
      'snapshot',jsonb_build_object('conversation_revision',1,'cutoff_at_ms',100000,'message_count',2,
        'ordered_segment_refs',jsonb_build_array(repeat('A',22),repeat('B',22)),'message_revisions','[1,1]'::jsonb,
        'pending_count',0,'coverage_gap',false,'earliest_evidence_at_ms',10000,'latest_evidence_at_ms',90000),
      'gate_evidence',jsonb_build_object('rule_version','contract-test','evaluated_gates','[]'::jsonb,'reason_codes','["LAZY_CONTEXT_REVIEW"]'::jsonb)),
    repeat(chr(65+n),22)) b;
end;
$$;
create function pg_temp.review_core(outcome text) returns jsonb language sql as $$
  select jsonb_build_object('outcome',outcome,'primary_category',case when outcome='confirmed' then 'bullying' end,
    'secondary_categories','[]'::jsonb,'severity',case when outcome='confirmed' then 'low' end,'urgency','routine',
    'child_role',case when outcome='confirmed' then 'target' else 'unknown' end,'pattern','isolated','confidence',0.9,
    'evidence_segment_refs',jsonb_build_array(repeat('B',22)));
$$;
do $$
declare b record; b2 record; result record; view_value jsonb; original jsonb; bad jsonb;
  explanation jsonb:=jsonb_build_object('contract_version','KIPPY_EXPERT_EXPLANATION_V1','statements',jsonb_build_array(
    jsonb_build_object('code','ORDINARY_CONVERSATION','evidence_segment_refs',jsonb_build_array(repeat('B',22)))));
begin
  perform pg_temp.review_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.v2_expert_explanations'::regclass),'forced RLS');
  perform pg_temp.review_assert(not has_table_privilege('anon','public.v2_expert_explanations','SELECT')
    and not has_table_privilege('authenticated','public.v2_expert_explanations','SELECT')
    and not has_table_privilege('service_role','public.v2_expert_explanations','INSERT'),'table not directly accessible');
  perform pg_temp.review_assert(not has_function_privilege('authenticated','public.v2_get_expert_review_service(uuid,uuid,uuid,bigint)','EXECUTE')
    and not has_function_privilege('anon','public.v2_finalize_three_gate_assessment_review_service(uuid,text,jsonb,text,text,jsonb,text)','EXECUTE')
    and has_function_privilege('service_role','public.v2_get_expert_review_service(uuid,uuid,uuid,bigint)','EXECUTE'),'RPC ACL');
  perform pg_temp.review_assert(public.v2_valid_expert_explanation_v1(explanation,array[repeat('B',22)]),'valid coded explanation');
  perform pg_temp.review_assert(not public.v2_valid_expert_explanation_v1(explanation,array[repeat('A',22)]),'foreign evidence rejected');
  perform pg_temp.review_assert(not public.v2_valid_expert_explanation_v1(explanation||'{"text":"forbidden"}'::jsonb),'extra prose rejected');
  perform pg_temp.review_assert(not public.v2_valid_expert_explanation_v1('null'::jsonb),'JSON null rejected');
  perform pg_temp.review_assert(not public.v2_valid_expert_explanation_v1('{"contract_version":null,"statements":null}'::jsonb),'malformed null fields rejected');
  perform pg_temp.review_assert(public.v2_expert_review_indexes(jsonb_build_array(repeat('B',22),repeat('A',22)),jsonb_build_array(repeat('A',22),repeat('B',22)))='[1,0]'::jsonb,'zero-based evidence order');

  select * into b from pg_temp.review_reserve(1);
  select * into result from public.v2_finalize_three_gate_assessment_review_service(b.incident_id,b.lease_token,
    pg_temp.review_core('dismissed'),'gpt-5.6-luna','kippy-expert-v6',explanation,'AVAILABLE');
  perform pg_temp.review_assert(result.analysis_outcome='dismissed' and result.delivery_count=0,'unchanged dismissed policy');
  select to_jsonb(a) into original from public.v2_three_gate_assessments a where a.incident_id=b.incident_id;
  perform pg_temp.review_assert(original->'analysis'=pg_temp.review_core('dismissed'),'exact nine policy fields retained');
  view_value:=public.v2_get_expert_review_service(pg_temp.review_id('44',1),pg_temp.review_id('66',1),pg_temp.review_id('77',1),1);
  perform pg_temp.review_assert(view_value#>'{analysis,evidence_indexes}'='[1]'::jsonb
    and view_value#>'{explanation,statements,0,evidence_indexes}'='[1]'::jsonb
    and view_value->>'explanation_status'='AVAILABLE'
    and position('evidence_segment_refs' in view_value::text)=0,'review contains indexes and no reference keys');
  perform public.v2_finalize_three_gate_assessment_review_service(b.incident_id,b.lease_token,
    pg_temp.review_core('dismissed'),'gpt-5.6-luna','kippy-expert-v6',null,'INVALID');
  perform pg_temp.review_assert((select to_jsonb(a)=original from public.v2_three_gate_assessments a where a.incident_id=b.incident_id),'core immutable on replay');
  perform pg_temp.review_assert(view_value=public.v2_get_expert_review_service(pg_temp.review_id('44',1),pg_temp.review_id('66',1),pg_temp.review_id('77',1),1),'first persisted review immutable on replay');
  perform pg_temp.review_assert(public.v2_get_expert_review_service(pg_temp.review_id('44',2),pg_temp.review_id('66',1),pg_temp.review_id('77',1),1) is null,'other child/device cannot retrieve review');
  perform pg_temp.review_assert(public.v2_get_expert_review_service(pg_temp.review_id('44',1),pg_temp.review_id('66',1),pg_temp.review_id('77',1),2) is null,'wrong sequence cannot retrieve review');

  select * into b from pg_temp.review_reserve(2);
  perform public.v2_finalize_three_gate_assessment_service(b.incident_id,b.lease_token,pg_temp.review_core('dismissed'),'gpt-5.6-luna','kippy-expert-v5');
  view_value:=public.v2_get_expert_review_service(pg_temp.review_id('44',1),pg_temp.review_id('66',2),pg_temp.review_id('77',2),1);
  perform pg_temp.review_assert(view_value->>'prompt_version'='kippy-expert-v5' and view_value->>'explanation_status'='NOT_PROVIDED'
    and view_value->'explanation'='null'::jsonb and view_value#>>'{analysis,outcome}'='dismissed','genuine legacy core without invented rationale');

  select * into b from pg_temp.review_reserve(3);
  bad:=explanation||'{"text":"not persisted"}'::jsonb;
  select * into result from public.v2_finalize_three_gate_assessment_review_service(b.incident_id,b.lease_token,
    pg_temp.review_core('confirmed'),'gpt-5.6-luna','kippy-expert-v6',bad,'AVAILABLE');
  perform pg_temp.review_assert(result.analysis_outcome='confirmed' and result.parent_incident_id=b.incident_id,'invalid explanation does not block confirmed policy');
  view_value:=public.v2_get_expert_review_service(pg_temp.review_id('44',1),pg_temp.review_id('66',3),pg_temp.review_id('77',3),1);
  perform pg_temp.review_assert(view_value->>'explanation_status'='INVALID' and view_value->'explanation'='null'::jsonb,'invalid optional prose discarded');

  select * into b from pg_temp.review_reserve(4);
  perform public.v2_record_expert_provider_attempt_v2_service(pg_temp.review_id('88',1),b.incident_id,b.lease_token,
    'ephemeral_v3','completed',200,50,10,0,10,0,'kippy-expert-v6');
  perform pg_temp.review_assert((select prompt_version='kippy-expert-v6' from public.v2_expert_provider_attempts where attempt_id=pg_temp.review_id('88',1)),'truthful v6 telemetry');
  perform public.v2_finalize_three_gate_assessment_review_service(b.incident_id,b.lease_token,
    pg_temp.review_core('inconclusive'),'gpt-5.6-luna','kippy-expert-v6',null,'NOT_PROVIDED');
  perform pg_temp.review_assert((select outcome='inconclusive' from public.v2_three_gate_assessments where incident_id=b.incident_id),'inconclusive preserved');
  perform pg_temp.review_assert(not exists(select 1 from public.v2_incident_context c join public.v2_safety_incidents i on i.id=c.incident_id where i.device_id=pg_temp.review_id('44',1)),'no conversation history persisted');
end;
$$;

-- Deliberately fail only the optional write, inside this rollback-only database.
create function pg_temp.reject_review_fixture() returns trigger language plpgsql as $$
begin raise exception 'simulated_optional_storage_failure'; end;
$$;
create trigger review_contract_optional_failure before insert on public.v2_expert_explanations
for each row execute function pg_temp.reject_review_fixture();
do $$ declare b record; r record; begin
  select * into b from pg_temp.review_reserve(5);
  select * into r from public.v2_finalize_three_gate_assessment_review_service(b.incident_id,b.lease_token,
    pg_temp.review_core('confirmed'),'gpt-5.6-luna','kippy-expert-v6',null,'NOT_PROVIDED');
  perform pg_temp.review_assert(r.analysis_outcome='confirmed' and r.parent_incident_id=b.incident_id,'storage failure never rolls back policy');
  perform pg_temp.review_assert((select outcome='confirmed' from public.v2_three_gate_assessments where incident_id=b.incident_id),'core commit survives optional subtransaction failure');
end $$;
rollback;
