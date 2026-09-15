\set ON_ERROR_STOP on
do $$ begin
 if current_database()<>'kippy_three_gate' or inet_server_addr()<>'127.0.0.1'::inet
   or inet_server_port()<>57439 then raise exception 'disposable_database_required'; end if;
end $$;
create or replace function pg_temp.lc_id(kind text,case_number integer,seq integer default 0)
returns uuid language sql as $$
 select (kind||'000000-0000-4000-8000-'||lpad(case_number::text,6,'0')||lpad(seq::text,6,'0'))::uuid;
$$;
create or replace function pg_temp.lc_analysis(outcome text,severity text default null)
returns jsonb language sql as $$
 select jsonb_build_object('outcome',outcome,'primary_category',case when outcome='confirmed' then 'bullying' end,
 'secondary_categories','[]'::jsonb,'severity',severity,'urgency',case when outcome='confirmed' then 'elevated' else 'routine' end,
 'child_role',case when outcome='confirmed' then 'target' else 'unknown' end,'pattern','repeated','confidence',0.9,
 'evidence_segment_refs',jsonb_build_array(repeat('A',22)));
$$;
create or replace function pg_temp.lc_reserve(case_number integer,seq integer)
returns table(incident_id uuid,lease_token text,assessment_id uuid) language plpgsql as $$
declare assessment uuid:=pg_temp.lc_id('7c',case_number,seq); b record;
begin
 select * into b from public.v2_begin_three_gate_assessment_service('4c000000-0000-4000-8000-000000000001',
 jsonb_build_object('target_device_id','4c000000-0000-4000-8000-000000000001','target_client_incident_id',assessment,
 'target_category','bullying','target_severity','high','target_child_role','target','target_confidence',0.9,
 'target_capture_quality',0.9,'target_occurred_at',now(),'target_model_contract_version',2,
 'target_privacy_contract_version',3,'target_privacy_identity_version',1,'target_key_version',1,
 'target_message_count',2,'target_context_expires_at',now()+interval '1 hour',
 'target_submission_hash_hex',repeat('a',64),'target_lease_seconds',120),
 jsonb_build_object('contract_version','THREE_GATE_FULL_FIFO_V1','case_id',pg_temp.lc_id('6c',case_number),
 'assessment_id',assessment,'assessment_seq',seq,'previous_assessment_id',case when seq>1 then pg_temp.lc_id('7c',case_number,seq-1) end,
 'origin_evidence_available',false,'digest_algorithm','HMAC_SHA256_JSON_BINARY_V1','payload_digest',repeat('b',64),
 'snapshot',jsonb_build_object('conversation_revision',seq,'cutoff_at_ms',100000+seq,'message_count',2,
   'ordered_segment_refs',jsonb_build_array(repeat('A',22),repeat('B',22)),'message_revisions',jsonb_build_array(seq,seq),
   'pending_count',0,'coverage_gap',false,'earliest_evidence_at_ms',10000,'latest_evidence_at_ms',90000),
 'gate_evidence',jsonb_build_object('rule_version','lifecycle-test','evaluated_gates','[1,2,3]'::jsonb,'reason_codes','["SYNTHETIC_PATTERN"]'::jsonb)),
 repeat(chr(65+case_number),22));
 return query select b.incident_id,b.lease_token,assessment;
end;
$$;
create or replace function pg_temp.lc_complete(case_number integer,seq integer,outcome text,severity text default null)
returns uuid language plpgsql as $$
declare b record;
begin
 select * into b from pg_temp.lc_reserve(case_number,seq);
 perform public.v2_finalize_three_gate_assessment_service(b.incident_id,b.lease_token,
   pg_temp.lc_analysis(outcome,severity),'gpt-5.6-luna','kippy-expert-v5');
 return b.incident_id;
end;
$$;
create or replace function pg_temp.lc_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'ASSERTION FAILED: %',label; end if; end;
$$;
create or replace function pg_temp.lc_error(statement text,expected_state text,expected_message text default null)
returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
   if sqlstate=expected_state and (expected_message is null or sqlerrm=expected_message) then return; end if;
   raise exception 'unexpected error % %',sqlstate,sqlerrm;
 end;
 raise exception 'expected error did not occur';
end;
$$;

\if :{?case_lifecycle_before_migration}
-- Intentional committed SYNTHETIC fixture before the new migration; the runner
-- discards this entire database. This proves actual migration backfill behavior.
begin;
insert into auth.users(id) values('1c000000-0000-4000-8000-000000000001'),
 ('1c000000-0000-4000-8000-000000000002'),('1c000000-0000-4000-8000-000000000003');
insert into public.v2_families(id,display_name) values
 ('2c000000-0000-4000-8000-000000000001','Synthetic lifecycle family'),
 ('2c000000-0000-4000-8000-000000000002','Synthetic other family');
insert into public.v2_children(id,family_id,display_name) values
 ('3c000000-0000-4000-8000-000000000001','2c000000-0000-4000-8000-000000000001','Synthetic child'),
 ('3c000000-0000-4000-8000-000000000002','2c000000-0000-4000-8000-000000000002','Synthetic other child');
insert into public.v2_guardian_memberships(family_id,guardian_user_id,role,status) values
 ('2c000000-0000-4000-8000-000000000001','1c000000-0000-4000-8000-000000000001','owner','active'),
 ('2c000000-0000-4000-8000-000000000001','1c000000-0000-4000-8000-000000000002','guardian','active'),
 ('2c000000-0000-4000-8000-000000000002','1c000000-0000-4000-8000-000000000003','owner','active');
insert into public.v2_protected_devices(id,child_id,installation_id,app_version,status) values
 ('4c000000-0000-4000-8000-000000000001','3c000000-0000-4000-8000-000000000001',
 '5c000000-0000-4000-8000-000000000001','synthetic-lifecycle','active');
do $$ declare parent uuid; begin
 parent:=pg_temp.lc_complete(1,1,'confirmed','high');
 perform set_config('request.jwt.claim.sub','1c000000-0000-4000-8000-000000000001',true);
 perform public.v2_set_guardian_incident_state(parent,'acknowledged','lifecycle-before-ack-1');
 update public.v2_guardian_incident_states set acknowledged_at=now()-interval '1 minute'
   where incident_id=parent and guardian_user_id=auth.uid();
 perform pg_temp.lc_complete(1,2,'confirmed','critical');
 perform set_config('request.jwt.claim.sub','1c000000-0000-4000-8000-000000000002',true);
 perform public.v2_set_guardian_incident_state(parent,'acknowledged','lifecycle-after-ack-2');
 parent:=pg_temp.lc_complete(2,1,'confirmed','high');
 perform set_config('request.jwt.claim.sub','1c000000-0000-4000-8000-000000000001',true);
 perform public.v2_set_guardian_incident_state(parent,'acknowledged','lifecycle-before-neutral');
 perform pg_temp.lc_complete(2,2,'inconclusive');
end $$;
commit;
\else
begin;
do $$
declare
 g1 constant uuid:='1c000000-0000-4000-8000-000000000001';
 g2 constant uuid:='1c000000-0000-4000-8000-000000000002';
 parent uuid; other_parent uuid; b1 record; b2 record; b3 record; s record; page record;
 ack_time timestamptz; initial_occurred timestamptz; after_newer timestamptz; before_events integer;
 first_page jsonb; all_items jsonb; original_analysis jsonb;
begin
 perform pg_temp.lc_assert(not has_table_privilege('authenticated','public.v2_guardian_case_attention_events','SELECT'),'events service only');
 perform pg_temp.lc_assert(not has_table_privilege('authenticated','public.v2_guardian_case_state_requests','SELECT'),'requests service only');
 perform pg_temp.lc_assert(not has_function_privilege('anon','public.v2_set_guardian_case_state(uuid,text,bigint,bigint,text)','EXECUTE'),'anonymous cannot mutate');
 select c.parent_incident_id into parent from public.v2_three_gate_cases c where c.case_id=pg_temp.lc_id('6c',1);
 perform pg_temp.lc_assert(parent is not null,'actual pre-migration fixture required');
 perform set_config('request.jwt.claim.sub',g1::text,true);
 select * into s from public.v2_get_guardian_case_summaries(array[parent]);
 perform pg_temp.lc_assert(s.guardian_state='new' and s.guardian_state_version=1 and s.attention_assessment_seq=2
   and s.acknowledged_at is not null and s.acknowledged_assessment_seq is null,'backfill reopens stale unversioned ack preserving history');
 perform set_config('request.jwt.claim.sub',g2::text,true);
 select * into s from public.v2_get_guardian_case_summaries(array[parent]);
 perform pg_temp.lc_assert(s.guardian_state='acknowledged' and s.guardian_state_version=0,'later guardian acknowledgment retained independently');
 select c.parent_incident_id into other_parent from public.v2_three_gate_cases c where c.case_id=pg_temp.lc_id('6c',2);
 perform set_config('request.jwt.claim.sub',g1::text,true);
 select * into s from public.v2_get_guardian_case_summaries(array[other_parent]);
 perform pg_temp.lc_assert(s.guardian_state='acknowledged' and s.attention_assessment_seq=1,'neutral backfill does not reopen');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_incident_state(%L,''acknowledged'',''old-client-case-ack'')',parent),
   '23505','guardian_assessment_version_required');

 -- Existing non-case incidents retain the old guardian state contract.
 insert into public.v2_safety_incidents
   (id,device_id,child_id,client_incident_id,category,severity,child_role,confidence,capture_quality,occurred_at,status,privacy_contract_version)
 values(pg_temp.lc_id('8c',1),'4c000000-0000-4000-8000-000000000001',
   '3c000000-0000-4000-8000-000000000001',pg_temp.lc_id('9c',1),'bullying','high','target',0.9,0.9,now(),'received',3);
 insert into public.v2_incident_analysis
   (incident_id,outcome,reason_code,action_code,safe_summary,safe_reason,recommended_action,model_provider,model_name,model_version,prompt_version,analysis_contract_version)
 values(pg_temp.lc_id('8c',1),'confirmed','bullying_pattern','professional_support','Synthetic summary',
   'Synthetic reason','Synthetic action','openai','gpt-5.6-luna','gpt-5.6-luna','kippy-expert-v5',2);
 update public.v2_safety_incidents set status='confirmed' where id=pg_temp.lc_id('8c',1);
 select * into s from public.v2_set_guardian_incident_state(pg_temp.lc_id('8c',1),'acknowledged','lifecycle-legacy-ack');
 perform pg_temp.lc_assert(s.state='acknowledged' and s.acknowledged_at is not null,'legacy state RPC remains compatible');
 perform pg_temp.lc_assert(not exists(select 1 from public.v2_get_guardian_case_summaries(array[pg_temp.lc_id('8c',1)])),
   'legacy summary absence is explicit');

 -- Ack first, then escalation: base state and home counts reopen atomically.
 parent:=pg_temp.lc_complete(3,1,'confirmed','low');
 select occurred_at into initial_occurred from public.v2_safety_incidents where id=parent;
 select to_jsonb(a) into original_analysis from public.v2_incident_analysis a where a.incident_id=parent;
 select * into s from public.v2_set_guardian_case_state(parent,'acknowledged',1,0,'lifecycle-g1-ack-one');
 ack_time:=s.acknowledged_at;
 perform pg_temp.lc_assert(s.state='acknowledged' and s.state_version=1 and s.acknowledged_assessment_seq=1,'versioned acknowledgment');
 perform set_config('request.jwt.claim.sub',g2::text,true);
 perform public.v2_set_guardian_case_state(parent,'saved',1,0,'lifecycle-g2-save-one');
 select * into b2 from pg_temp.lc_reserve(3,2);
 perform public.v2_finalize_three_gate_assessment_service(b2.incident_id,b2.lease_token,pg_temp.lc_analysis('confirmed','high'),'gpt-5.6-luna','kippy-expert-v5');
 perform pg_temp.lc_assert((select count(*)=2 from public.v2_guardian_incident_states where incident_id=parent and state='new' and state_version=2),'both guardians reopened');
 perform set_config('request.jwt.claim.sub',g1::text,true);
 select * into s from public.v2_get_guardian_case_summaries(array[parent]);
 perform pg_temp.lc_assert(s.assessment_seq=2 and s.attention_assessment_seq=2 and s.acknowledged_assessment_seq=1
   and s.acknowledged_at=ack_time and s.expert_severity='high' and s.latest_assessment_at is not null,'atomic current summary and prior ack');
 select * into s from public.v2_set_guardian_case_state(parent,'acknowledged',1,0,'lifecycle-g1-ack-one');
 perform pg_temp.lc_assert(s.replayed and s.state='new' and s.state_version=2 and s.assessment_seq=2,'old action replay returns current reopened state');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_case_state(%L,''acknowledged'',1,2,''lifecycle-stale-assessment'')',parent),'23505','guardian_assessment_version_conflict');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_case_state(%L,''acknowledged'',2,0,''lifecycle-stale-state'')',parent),'23505','guardian_state_version_conflict');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_case_state(%L,''saved'',1,0,''lifecycle-g1-ack-one'')',parent),'23505','guardian_case_request_conflict');
 select * into s from public.v2_set_guardian_case_state(parent,'acknowledged',2,2,'lifecycle-g1-ack-two');
 perform pg_temp.lc_assert(s.state_version=3 and s.acknowledged_assessment_seq=2,'fresh assessment acknowledgment');
 perform pg_temp.lc_assert((select state='new' from public.v2_guardian_incident_states where incident_id=parent and guardian_user_id=g2),'one guardian cannot acknowledge for other');
 select count(*) into before_events from public.v2_guardian_case_attention_events where incident_id=parent;
 perform public.v2_finalize_three_gate_assessment_service(b2.incident_id,b2.lease_token,pg_temp.lc_analysis('confirmed','high'),'gpt-5.6-luna','kippy-expert-v5');
 perform pg_temp.lc_assert((select count(*)=before_events from public.v2_guardian_case_attention_events where incident_id=parent)
   and (select state_version=3 from public.v2_guardian_incident_states where incident_id=parent and guardian_user_id=g1),'duplicate finalization no reopen');
 perform pg_temp.lc_complete(3,3,'inconclusive');
 select * into s from public.v2_get_guardian_case_summaries(array[parent]);
 perform pg_temp.lc_assert(s.assessment_seq=3 and s.guardian_state='acknowledged' and s.attention_assessment_seq=2
   and s.expert_severity is null,'newer neutral advances current without attention');
 perform pg_temp.lc_assert((select i.updated_at>=a.completed_at from public.v2_safety_incidents i join public.v2_three_gate_assessments a
   on a.device_id='4c000000-0000-4000-8000-000000000001' and a.case_id=pg_temp.lc_id('6c',3) and a.assessment_seq=3 where i.id=parent),'neutral updates parent recency');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_case_state(%L,''acknowledged'',2,3,''lifecycle-neutral-stale'')',parent),'23505','guardian_assessment_version_conflict');

 -- Paginate a frozen snapshot; newer follow-up is excluded, no silent truncation.
 select * into page from public.v2_get_guardian_case_history(parent,3,3,0,2);
 first_page:=page.assessments;
 perform pg_temp.lc_assert(page.has_more and page.next_after_seq=2 and jsonb_array_length(first_page)=2,'explicit history cursor');
 perform pg_temp.lc_complete(3,4,'confirmed','critical');
 select * into page from public.v2_get_guardian_case_history(parent,3,3,page.next_after_seq,2);
 all_items:=first_page||page.assessments;
 perform pg_temp.lc_assert(not page.has_more and page.next_after_seq is null and jsonb_array_length(all_items)=3
   and all_items#>>'{2,assessment_seq}'='3','bounded history does not mix unseen seq4');
 perform pg_temp.lc_assert(not exists(select 1 from jsonb_array_elements(all_items) item where
   item ?| array['manifest','conversation_ref','assessment_id','case_id','evidence_segment_refs','model_version','payload_digest']
   or jsonb_typeof(item->'safe_summary') is distinct from 'string' or jsonb_typeof(item->'safe_reason') is distinct from 'string'
   or jsonb_typeof(item->'recommended_action') is distinct from 'string'),'safe complete history projection');
 perform pg_temp.lc_error(format('select public.v2_get_guardian_case_history(%L,5,4,0,50)',parent),'22023','invalid_guardian_case_history_page');
 perform pg_temp.lc_assert((select occurred_at=initial_occurred from public.v2_safety_incidents where id=parent)
   and (select to_jsonb(a)=original_analysis from public.v2_incident_analysis a where a.incident_id=parent),'original incident time and immutable analysis untouched');

 -- A late old critical result does not reopen or change current/recency.
 other_parent:=pg_temp.lc_complete(4,1,'confirmed','high');
 select * into b2 from pg_temp.lc_reserve(4,2);
 perform pg_temp.lc_complete(4,3,'dismissed');
 perform public.v2_set_guardian_case_state(other_parent,'acknowledged',3,0,'lifecycle-out-of-order-ack');
 select updated_at into after_newer from public.v2_safety_incidents where id=other_parent;
 perform public.v2_finalize_three_gate_assessment_service(b2.incident_id,b2.lease_token,pg_temp.lc_analysis('confirmed','critical'),'gpt-5.6-luna','kippy-expert-v5');
 select * into s from public.v2_get_guardian_case_summaries(array[other_parent]);
 perform pg_temp.lc_assert(s.assessment_seq=3 and s.expert_outcome='dismissed' and s.guardian_state='acknowledged'
   and s.attention_assessment_seq=1 and (select updated_at=after_newer from public.v2_safety_incidents where id=other_parent),'old critical neither reopens nor overwrites');
 perform pg_temp.lc_complete(4,4,'confirmed','critical');
 select * into s from public.v2_get_guardian_case_summaries(array[other_parent]);
 perform pg_temp.lc_assert(s.attention_assessment_seq=1 and s.guardian_state='acknowledged','prior late maximum prevents false repeated escalation');

 -- First confirmation completing behind a newer neutral result still creates attention.
 select * into b1 from pg_temp.lc_reserve(5,1);
 perform pg_temp.lc_complete(5,2,'inconclusive');
 perform public.v2_finalize_three_gate_assessment_service(b1.incident_id,b1.lease_token,pg_temp.lc_analysis('confirmed','high'),'gpt-5.6-luna','kippy-expert-v5');
 select * into s from public.v2_get_guardian_case_summaries(array[b1.incident_id]);
 perform pg_temp.lc_assert(s.assessment_seq=2 and s.expert_outcome='inconclusive' and s.attention_assessment_seq=1,'late first confirmation retains newer current');
 perform public.v2_set_guardian_case_state(b1.incident_id,'acknowledged',2,0,'lifecycle-late-first-ack');
 select * into page from public.v2_get_guardian_case_history(b1.incident_id,2,2,0,50);
 perform pg_temp.lc_assert(jsonb_array_length(page.assessments)=2 and
   not exists(select 1 from jsonb_array_elements(page.assessments) item where item->>'recommended_action' is null),'pre-first neutral history has explicit string');

 -- A lower sequence completed between pages must invalidate the captured set.
 other_parent:=pg_temp.lc_complete(8,1,'confirmed','low');
 select * into b2 from pg_temp.lc_reserve(8,2);
 perform pg_temp.lc_complete(8,3,'inconclusive');
 select * into s from public.v2_get_guardian_case_summaries(array[other_parent]);
 perform pg_temp.lc_assert(s.history_assessment_count=2 and s.assessment_seq=3,'current snapshot captures completed count');
 select * into page from public.v2_get_guardian_case_history(other_parent,3,2,0,1);
 perform pg_temp.lc_assert(page.has_more and page.next_after_seq=1,'history page before late completion');
 perform public.v2_finalize_three_gate_assessment_service(b2.incident_id,b2.lease_token,
   pg_temp.lc_analysis('confirmed','high'),'gpt-5.6-luna','kippy-expert-v5');
 perform pg_temp.lc_error(format('select public.v2_get_guardian_case_history(%L,3,2,1,50)',other_parent),
   '23505','guardian_history_snapshot_conflict');
 select * into s from public.v2_get_guardian_case_summaries(array[other_parent]);
 select * into page from public.v2_get_guardian_case_history(other_parent,3,s.history_assessment_count,0,50);
 perform pg_temp.lc_assert(s.history_assessment_count=3 and jsonb_array_length(page.assessments)=3,
   'refreshed snapshot includes late completion without silent omission');

 -- New derived metadata must not obstruct cleanup of otherwise deletable input.
 -- Use an uncompleted incident, leaving all protected confirmed history intact.
 select * into b3 from pg_temp.lc_reserve(6,1);
 insert into auth.users(id) values('1c000000-0000-4000-8000-000000000099');
 insert into public.v2_guardian_case_state_requests
   (guardian_user_id,request_key_hash,incident_id,request_hash,applied_assessment_seq,applied_state_version)
 values('1c000000-0000-4000-8000-000000000099',decode(repeat('a',64),'hex'),b3.incident_id,decode(repeat('b',64),'hex'),1,1);
 delete from auth.users where id='1c000000-0000-4000-8000-000000000099';
 perform pg_temp.lc_assert(not exists(select 1 from public.v2_guardian_case_state_requests where incident_id=b3.incident_id),'request metadata cascades with guardian cleanup');
 insert into public.v2_guardian_case_attention_events(incident_id,assessment_seq,assessment_incident_id,occurred_at)
 values(b3.incident_id,1,b3.incident_id,now());
 insert into public.v2_guardian_case_state_requests
   (guardian_user_id,request_key_hash,incident_id,request_hash,applied_assessment_seq,applied_state_version)
 values(g1,decode(repeat('c',64),'hex'),b3.incident_id,decode(repeat('d',64),'hex'),1,1);
 delete from public.v2_safety_incidents where id=b3.incident_id;
 perform pg_temp.lc_assert(not exists(select 1 from public.v2_guardian_case_attention_events where incident_id=b3.incident_id)
   and not exists(select 1 from public.v2_guardian_case_state_requests where incident_id=b3.incident_id),'derived metadata cascades with incident cleanup');
 select * into b3 from pg_temp.lc_reserve(7,1);
 insert into public.v2_guardian_case_attention_events(incident_id,assessment_seq,assessment_incident_id,occurred_at)
 values(b3.incident_id,1,b3.incident_id,now());
 delete from public.v2_three_gate_assessments where incident_id=b3.incident_id;
 perform pg_temp.lc_assert(not exists(select 1 from public.v2_guardian_case_attention_events where incident_id=b3.incident_id),
   'attention metadata cascades with assessment cleanup');

 -- Scope, revoked membership and replay authorization are checked every time.
 perform set_config('request.jwt.claim.sub','1c000000-0000-4000-8000-000000000003',true);
 perform pg_temp.lc_assert(not exists(select 1 from public.v2_get_guardian_case_summaries(array[parent])),'cross-family summary hidden');
 perform pg_temp.lc_error(format('select public.v2_get_guardian_case_history(%L,4,4,0,50)',parent),'42501');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_case_state(%L,''new'',4,0,''lifecycle-cross-family'')',parent),'42501');
 perform set_config('request.jwt.claim.sub',g1::text,true);
 update public.v2_guardian_memberships set status='revoked' where guardian_user_id=g1 and family_id='2c000000-0000-4000-8000-000000000001';
 perform pg_temp.lc_assert(not exists(select 1 from public.v2_get_guardian_case_summaries(array[parent])),'revoked summary hidden');
 perform pg_temp.lc_error(format('select public.v2_set_guardian_case_state(%L,''acknowledged'',1,0,''lifecycle-g1-ack-one'')',parent),'42501');
 perform pg_temp.lc_error(format('select public.v2_get_guardian_case_history(%L,4,4,0,50)',parent),'42501');
 raise notice 'PASS: actual backfill, atomic reopening, two guardians, version/replay conflicts, safe snapshot pagination, neutral recency, late completions and revoked/cross-family authorization';
end;
$$;
rollback;
\endif
