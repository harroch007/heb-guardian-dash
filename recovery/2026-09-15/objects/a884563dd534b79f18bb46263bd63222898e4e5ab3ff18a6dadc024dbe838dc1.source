begin;

-- Preserve current deployed policy bodies; only allow the truthful new prompt ID.
do $guards$
declare signature text; definition text; needle text := 'target_prompt_version is distinct from ''kippy-expert-v5''';
begin
  foreach signature in array array[
    'public.v2_finalize_three_gate_assessment_service(uuid,text,jsonb,text,text)',
    'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[],text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then
      raise exception 'unexpected_expert_prompt_guard';
    end if;
    execute replace(definition,needle,
      '(target_prompt_version is null or target_prompt_version not in (''kippy-expert-v5'',''kippy-expert-v6''))');
  end loop;
end;
$guards$;

alter table public.v2_expert_provider_attempts drop constraint v2_expert_provider_attempts_prompt_version_check;
alter table public.v2_expert_provider_attempts add constraint v2_expert_provider_attempts_prompt_version_check
  check (prompt_version in ('kippy-expert-v4','kippy-expert-v5','kippy-expert-v6'));

-- A new name avoids overload ambiguity. Keep the legacy telemetry function intact.
do $telemetry$
declare definition text; old_text text; new_text text; replacements text[][] := array[
  ['public.v2_record_expert_provider_attempt_service(', 'public.v2_record_expert_provider_attempt_v2_service('],
  ['target_reasoning_tokens integer)', 'target_reasoning_tokens integer, target_prompt_version text)'],
  ['if target_attempt_id is null', 'if target_prompt_version is null or target_prompt_version not in (''kippy-expert-v4'',''kippy-expert-v5'',''kippy-expert-v6'') or (target_endpoint = ''stored_queue'' and target_prompt_version <> ''kippy-expert-v4'') or (target_endpoint = ''ephemeral_v3'' and target_prompt_version not in (''kippy-expert-v5'',''kippy-expert-v6'')) then raise exception ''invalid_provider_prompt_version'' using errcode = ''22023''; end if; if target_attempt_id is null'],
  ['and a.incident_id = target_incident_id and a.endpoint = target_endpoint', 'and a.incident_id = target_incident_id and a.endpoint = target_endpoint and a.prompt_version = target_prompt_version'],
  ['case target_endpoint when ''ephemeral_v3'' then ''kippy-expert-v5'' else ''kippy-expert-v4'' end', 'target_prompt_version']
]; i integer;
begin
  definition := pg_get_functiondef('public.v2_record_expert_provider_attempt_service(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer)'::regprocedure);
  for i in 1..array_length(replacements,1) loop
    old_text := replacements[i][1]; new_text := replacements[i][2];
    if (length(definition)-length(replace(definition,old_text,'')))/length(old_text) <> 1 then
      raise exception 'unexpected_provider_telemetry_definition';
    end if;
    definition := replace(definition,old_text,new_text);
  end loop;
  execute definition;
end;
$telemetry$;

create function public.v2_valid_expert_explanation_v1(value jsonb, allowed_refs text[] default null)
returns boolean language plpgsql immutable set search_path='' as $$
declare statement jsonb; code text; seen text[] := '{}'; refs text[];
begin
  if value is null or jsonb_typeof(value) <> 'object' or pg_column_size(value)>8192
    or (select count(*) from jsonb_object_keys(value))<>2
    or not (value ?& array['contract_version','statements'])
    or value->>'contract_version' is distinct from 'KIPPY_EXPERT_EXPLANATION_V1'
    or jsonb_typeof(value->'statements') is distinct from 'array'
    or jsonb_array_length(value->'statements') not between 1 and 3 then return false; end if;
  for statement in select * from jsonb_array_elements(value->'statements') loop
    if jsonb_typeof(statement)<>'object' or (select count(*) from jsonb_object_keys(statement))<>2
      or not (statement ?& array['code','evidence_segment_refs'])
      or jsonb_typeof(statement->'code') is distinct from 'string'
      or jsonb_typeof(statement->'evidence_segment_refs') is distinct from 'array'
      or jsonb_array_length(statement->'evidence_segment_refs') not between 1 and 5 then return false; end if;
    code := statement->>'code';
    if code = any(seen) or code not in (
      'ORDINARY_CONVERSATION','NON_LITERAL_OR_BANTER','THIRD_PARTY_DISCUSSION','NO_SUPPORTED_TARGETED_HARM',
      'DIRECT_TARGETED_HARM','REPEATED_HARM_PATTERN','COERCION_OR_EXPLOITATION','SEXUAL_SAFETY_CONCERN',
      'SELF_HARM_CONCERN','PERSONAL_INFORMATION_EXPOSURE','SUSPICIOUS_REQUEST','AMBIGUOUS_MEANING',
      'UNCERTAIN_ATTRIBUTION','CONTEXT_GAP') then return false; end if;
    if exists(select 1 from jsonb_array_elements(statement->'evidence_segment_refs') r
      where jsonb_typeof(r) is distinct from 'string') then return false; end if;
    refs := array(select jsonb_array_elements_text(statement->'evidence_segment_refs'));
    if not public.v2_valid_segment_refs(refs) or (allowed_refs is not null and not refs <@ allowed_refs) then return false; end if;
    seen := array_append(seen,code);
  end loop;
  return true;
exception when others then return false;
end;
$$;

create table public.v2_expert_explanations (
  incident_id uuid primary key references public.v2_three_gate_assessments(incident_id) on delete cascade,
  explanation_status text not null check (explanation_status in ('AVAILABLE','NOT_PROVIDED','INVALID')),
  explanation jsonb,
  created_at timestamptz not null default now(),
  check ((explanation_status='AVAILABLE' and explanation is not null and public.v2_valid_expert_explanation_v1(explanation))
    or (explanation_status<>'AVAILABLE' and explanation is null))
);
alter table public.v2_expert_explanations enable row level security;
alter table public.v2_expert_explanations force row level security;
revoke all on public.v2_expert_explanations from public,anon,authenticated,service_role;
comment on table public.v2_expert_explanations is 'Service-only immutable model-selected rationale codes and existing assessment references. No prose, identifiers, or conversation text. Deleted with its assessment.';

create function public.v2_finalize_three_gate_assessment_review_service(
  target_incident_id uuid,target_lease_token text,target_analysis jsonb,target_model_version text,target_prompt_version text,
  target_explanation jsonb,target_explanation_status text
) returns table(incident_status text,analysis_outcome text,delivery_count integer,parent_incident_id uuid)
language plpgsql security definer set search_path='' as $$
declare result record; status_value text; explanation_value jsonb; allowed_refs text[];
begin
  -- The existing finalizer retains all auth, lease, idempotency and policy decisions.
  select * into result from public.v2_finalize_three_gate_assessment_service(
    target_incident_id,target_lease_token,target_analysis,target_model_version,target_prompt_version);
  -- A subtransaction confines optional failures: never roll back the valid policy.
  begin
    status_value := 'INVALID'; explanation_value := null;
    if target_explanation_status='NOT_PROVIDED' and target_explanation is null then
      status_value := 'NOT_PROVIDED';
    elsif target_explanation_status='AVAILABLE' and target_prompt_version='kippy-expert-v6' then
      allowed_refs := array(select jsonb_array_elements_text(target_analysis->'evidence_segment_refs'));
      if public.v2_valid_expert_explanation_v1(target_explanation,allowed_refs) then
        status_value := 'AVAILABLE'; explanation_value := target_explanation;
      end if;
    end if;
    insert into public.v2_expert_explanations(incident_id,explanation_status,explanation)
      values(target_incident_id,status_value,explanation_value) on conflict(incident_id) do nothing;
  exception when others then
    raise log 'expert_explanation_persistence_failed';
  end;
  return query select result.incident_status,result.analysis_outcome,result.delivery_count,result.parent_incident_id;
end;
$$;

create function public.v2_expert_review_indexes(refs jsonb, ordered_refs jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_agg(s.n-1 order by e.n),'[]'::jsonb)
  from jsonb_array_elements_text(refs) with ordinality e(ref,n)
  join jsonb_array_elements_text(ordered_refs) with ordinality s(ref,n) on e.ref=s.ref;
$$;

create function public.v2_get_expert_review_service(
  target_device_id uuid,target_case_id uuid,target_assessment_id uuid,target_assessment_seq bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.v2_three_gate_assessments%rowtype; e public.v2_expert_explanations%rowtype;
  receipt record; indexes jsonb; statement jsonb; statements jsonb := '[]'; explanation_value jsonb := null;
begin
  -- Reuse the exact existing tenant/device/child/case binding and completion check.
  select * into receipt from public.v2_get_three_gate_assessment_receipt_service(
    target_device_id,target_case_id,target_assessment_id,target_assessment_seq);
  if receipt.receipt_state is distinct from 'completed' then return null; end if;
  select * into a from public.v2_three_gate_assessments x where x.device_id=target_device_id
    and x.case_id=target_case_id and x.assessment_id=target_assessment_id and x.assessment_seq=target_assessment_seq;
  indexes := public.v2_expert_review_indexes(a.analysis->'evidence_segment_refs',a.manifest#>'{snapshot,ordered_segment_refs}');
  if jsonb_array_length(indexes)<>jsonb_array_length(a.analysis->'evidence_segment_refs') then return null; end if;
  select * into e from public.v2_expert_explanations x where x.incident_id=a.incident_id;
  if e.explanation_status='AVAILABLE' then
    for statement in select * from jsonb_array_elements(e.explanation->'statements') loop
      statements := statements || jsonb_build_array(jsonb_build_object('code',statement->>'code',
        'evidence_indexes',public.v2_expert_review_indexes(statement->'evidence_segment_refs',a.manifest#>'{snapshot,ordered_segment_refs}')));
    end loop;
    explanation_value := jsonb_build_object('contract_version','KIPPY_EXPERT_EXPLANATION_V1','statements',statements);
  end if;
  return jsonb_build_object('contract_version','KIPPY_EXPERT_REVIEW_V1','model_version',a.model_version,
    'prompt_version',a.prompt_version,'analysis',(a.analysis-'evidence_segment_refs')||jsonb_build_object('evidence_indexes',indexes),
    'explanation_status',coalesce(e.explanation_status,'NOT_PROVIDED'),'explanation',explanation_value);
end;
$$;

revoke all on function public.v2_valid_expert_explanation_v1(jsonb,text[]) from public,anon,authenticated;
revoke all on function public.v2_expert_review_indexes(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.v2_finalize_three_gate_assessment_review_service(uuid,text,jsonb,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.v2_get_expert_review_service(uuid,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.v2_record_expert_provider_attempt_v2_service(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer,text) from public,anon,authenticated;
grant execute on function public.v2_valid_expert_explanation_v1(jsonb,text[]) to service_role;
grant execute on function public.v2_expert_review_indexes(jsonb,jsonb) to service_role;
grant execute on function public.v2_finalize_three_gate_assessment_review_service(uuid,text,jsonb,text,text,jsonb,text) to service_role;
grant execute on function public.v2_get_expert_review_service(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.v2_record_expert_provider_attempt_v2_service(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer,text) to service_role;

commit;
