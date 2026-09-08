begin;

-- No context, ciphertext, digest key, prompt, quote or free-text inference is stored.
create table public.v2_three_gate_cases (
    device_id uuid not null references public.v2_protected_devices(id) on delete cascade,
    case_id uuid not null,
    child_id uuid not null references public.v2_children(id) on delete cascade,
    conversation_ref text not null check (conversation_ref ~ '^[A-Za-z0-9_-]{22}$'),
    privacy_identity_version bigint not null check (privacy_identity_version > 0),
    latest_submitted_seq bigint not null default 0 check (latest_submitted_seq >= 0),
    latest_submitted_id uuid,
    latest_conversation_revision bigint not null default 0,
    latest_cutoff_at_ms bigint not null default 0,
    latest_applied_seq bigint not null default 0 check (latest_applied_seq >= 0),
    latest_outcome text check (latest_outcome in ('confirmed','dismissed','inconclusive')),
    latest_analysis jsonb,
    parent_incident_id uuid unique references public.v2_safety_incidents(id) on delete set null,
    first_confirmed_seq bigint,
    highest_confirmed_severity integer not null default 0 check (highest_confirmed_severity between 0 and 4),
    updated_at timestamptz not null default now(),
    primary key (device_id, case_id)
);
create table public.v2_three_gate_assessments (
    incident_id uuid primary key references public.v2_safety_incidents(id) on delete cascade,
    device_id uuid not null,
    case_id uuid not null,
    assessment_id uuid not null,
    assessment_seq bigint not null check (assessment_seq between 1 and 9007199254740991),
    previous_assessment_id uuid,
    manifest jsonb not null,
    outcome text check (outcome in ('confirmed','dismissed','inconclusive')),
    analysis jsonb,
    model_version text,
    prompt_version text,
    completion_hash bytea,
    completion_lease_hash bytea,
    parent_incident_id uuid references public.v2_safety_incidents(id) on delete set null,
    delivery_count integer not null default 0,
    completed_at timestamptz,
    foreign key (device_id, case_id) references public.v2_three_gate_cases(device_id, case_id) on delete cascade,
    unique (device_id, assessment_id),
    unique (device_id, case_id, assessment_seq),
    check ((assessment_seq = 1 and previous_assessment_id is null) or
           (assessment_seq > 1 and previous_assessment_id is not null)),
    check ((outcome is null and completed_at is null and analysis is null) or
           (outcome is not null and completed_at is not null and analysis is not null
            and completion_hash is not null and completion_lease_hash is not null))
);
alter table public.v2_three_gate_cases enable row level security;
alter table public.v2_three_gate_cases force row level security;
alter table public.v2_three_gate_assessments enable row level security;
alter table public.v2_three_gate_assessments force row level security;
revoke all on public.v2_three_gate_cases, public.v2_three_gate_assessments from public, anon, authenticated;

-- Legacy deliveries keep exactly one 'initial' event. A case escalation uses
-- the same confirmed parent, with one separate event per newly observed rank.
alter table public.v2_alert_deliveries
  add column event_key text not null default 'initial',
  add column event_assessment_id uuid references public.v2_three_gate_assessments(incident_id),
  add constraint v2_alert_delivery_event_shape check (
    (event_key = 'initial' and event_assessment_id is null) or
    (event_key ~ '^three-gate-severity:[2-4]$' and event_assessment_id is not null)),
  drop constraint v2_alert_deliveries_incident_guardian_channel_key,
  add constraint v2_alert_deliveries_incident_guardian_channel_event_key
    unique (incident_id, guardian_user_id, channel, event_key);

-- Four known finalizers are the ONLY consumers of the old conflict target.
-- Match their exact existing clauses once; abort all changes on schema drift.
do $patch_legacy_deliveries$
declare
  signatures constant text[] := array[
    'public.v2_finalize_incident_analysis_internal(uuid,text,text,text,text,text,text,text,text,smallint)',
    'public.v2_finalize_incident_analysis_service(text,uuid,text,uuid,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])',
    'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])',
    'public.v2_finalize_ephemeral_incident_analysis_service(uuid,text,text,text,text,text,text,text[],text,text,text,text,real,text[],text[],text)'
  ];
  compact constant text := 'on conflict (incident_id, guardian_user_id, channel) do nothing;';
  multiline constant text := E'on conflict (\n            incident_id,\n            guardian_user_id,\n            channel\n        ) do nothing;';
  replacement constant text := 'on conflict (incident_id, guardian_user_id, channel, event_key) do nothing;';
  identity text; object_id oid; known_oids oid[] := '{}'; definition text; needle text; patched text;
begin
  foreach identity in array signatures loop
    object_id := to_regprocedure(identity);
    if object_id is null then raise exception 'three_gate_legacy_finalizer_missing: %',identity; end if;
    known_oids := array_append(known_oids,object_id);
    definition := pg_get_functiondef(object_id);
    needle := case when position(compact in definition) > 0 then compact else multiline end;
    if position(needle in definition)=0 then needle := replace(needle,E'\n',E'\r\n'); end if;
    if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1
       or (select count(*) from regexp_matches(definition,
         'on conflict\s*\(\s*incident_id\s*,\s*guardian_user_id\s*,\s*channel\s*\)', 'gi')) <> 1 then
      raise exception 'three_gate_legacy_conflict_target_drift: %',identity;
    end if;
    patched := replace(definition,needle,replacement);
    raise notice 'three_gate_finalizer_patch % before=% after=%',identity,
      encode(extensions.digest(convert_to(definition,'UTF8'),'sha256'),'hex'),
      encode(extensions.digest(convert_to(patched,'UTF8'),'sha256'),'hex');
    execute patched;
  end loop;
  if cardinality(known_oids) <> 4 or exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and not p.oid=any(known_oids)
      and p.prosrc ~* 'on conflict\s*\(\s*incident_id\s*,\s*guardian_user_id\s*,\s*channel\s*\)'
  ) then raise exception 'three_gate_unexpected_legacy_conflict_consumer'; end if;
end;
$patch_legacy_deliveries$;

-- Completed assessment history is immutable; mutable case projection is separate.
create function public.v2_guard_three_gate_assessment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if old.outcome is not null and new is distinct from old then
        raise exception 'three_gate_assessment_is_immutable' using errcode = '23514';
    end if;
    return new;
end;
$$;
create trigger v2_three_gate_assessment_immutable before update on public.v2_three_gate_assessments
for each row execute function public.v2_guard_three_gate_assessment();

-- Permit a terminal, non-parent assessment status without weakening legacy transitions.
alter table public.v2_safety_incidents drop constraint v2_safety_incidents_status_check;
alter table public.v2_safety_incidents add constraint v2_safety_incidents_status_check check
    (status in ('received','analyzing','confirmed','dismissed','analysis_failed','alerted','assessed'));
do $$
declare definition text;
begin
    definition := pg_get_functiondef('public.v2_guard_incident_status()'::regprocedure);
    if position('valid_transition := case old.status' in definition) = 0 then
        raise exception 'unexpected_incident_status_guard';
    end if;
    definition := replace(definition, 'valid_transition := case old.status',
      'if new.status = ''assessed'' and old.status in (''received'',''analyzing'',''assessed'')
          and exists (select 1 from public.v2_three_gate_assessments a
                      where a.incident_id = new.id and a.outcome is not null) then
          return new;
       end if;
       valid_transition := case old.status');
    execute definition;
end;
$$;
-- Broaden only the receipt terminal-outcome check. Legacy finalizers remain unchanged.
do $$
declare item record; matched_count integer := 0;
begin
    for item in select conname, pg_get_constraintdef(oid) as definition
        from pg_constraint where conrelid = 'public.v2_ephemeral_incident_receipts'::regclass
        and contype = 'c' and pg_get_constraintdef(oid) like '%completion_analysis_outcome%'
    loop
        matched_count := matched_count + 1;
        execute format('alter table public.v2_ephemeral_incident_receipts drop constraint %I', item.conname);
        execute format('alter table public.v2_ephemeral_incident_receipts add constraint %I %s', item.conname,
          replace(item.definition, '''dismissed''::text', '''dismissed''::text, ''inconclusive''::text'));
    end loop;
    if matched_count <> 1 then raise exception 'unexpected_ephemeral_receipt_outcome_constraint'; end if;
end;
$$;

create function public.v2_begin_three_gate_assessment_service(
    target_device_id uuid, target_header jsonb, target_metadata jsonb, target_conversation_ref text
) returns table (incident_id uuid, created boolean, analysis_state text, lease_token text,
                 incident_status text, analysis_outcome text, delivery_count integer, parent_incident_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
    child uuid; case_uuid uuid; assessment_uuid uuid; seq bigint; previous_uuid uuid;
    privacy_version bigint; revision bigint; cutoff bigint; previous_state text;
    c public.v2_three_gate_cases%rowtype; a public.v2_three_gate_assessments%rowtype;
    b record;
begin
    select d.child_id into child from public.v2_protected_devices d
      where d.id = target_device_id and d.status in ('active','degraded');
    if child is null then raise exception 'device_not_active' using errcode = '42501'; end if;
    if target_metadata is null or jsonb_typeof(target_metadata) <> 'object'
       or (select count(*) from jsonb_object_keys(target_metadata)) not between 9 and 11
       or exists (select 1 from jsonb_object_keys(target_metadata) k where k not in
          ('contract_version','case_id','assessment_id','assessment_seq','previous_assessment_id','previous_assessment_state',
           'origin_evidence_available','snapshot','gate_evidence','digest_algorithm','payload_digest'))
       or target_metadata->>'contract_version' is distinct from 'THREE_GATE_FULL_FIFO_V1'
       or target_metadata->>'digest_algorithm' is distinct from 'HMAC_SHA256_JSON_BINARY_V1'
       or target_metadata->>'origin_evidence_available' is distinct from 'false'
       or target_metadata->>'payload_digest' is null
       or target_metadata->>'payload_digest' !~ '^[0-9a-f]{64}$'
       or target_conversation_ref is null or target_conversation_ref !~ '^[A-Za-z0-9_-]{22}$'
       or target_header->>'target_device_id' is distinct from target_device_id::text then
        raise exception 'invalid_three_gate_metadata' using errcode = '22023';
    end if;
    case_uuid := (target_metadata->>'case_id')::uuid;
    assessment_uuid := (target_metadata->>'assessment_id')::uuid;
    seq := (target_metadata->>'assessment_seq')::bigint;
    previous_uuid := (target_metadata->>'previous_assessment_id')::uuid;
    previous_state := coalesce(target_metadata->>'previous_assessment_state','submitted');
    privacy_version := (target_header->>'target_privacy_identity_version')::bigint;
    revision := (target_metadata#>>'{snapshot,conversation_revision}')::bigint;
    cutoff := (target_metadata#>>'{snapshot,cutoff_at_ms}')::bigint;
    if case_uuid is null or assessment_uuid is null or seq is null or seq < 1 or seq > 9007199254740991
       or (seq = 1 and previous_uuid is not null) or (seq > 1 and previous_uuid is null)
       or previous_uuid = assessment_uuid
       or (seq = 1 and target_metadata ? 'previous_assessment_state')
       or (target_metadata ? 'previous_assessment_state' and jsonb_typeof(target_metadata->'previous_assessment_state') <> 'string')
       or previous_state not in ('submitted','cancelled_before_submission')
       or assessment_uuid::text is distinct from target_header->>'target_client_incident_id'
       or revision is null or revision < 1 or cutoff is null or cutoff < 0
       or target_metadata#>>'{snapshot,message_count}' is distinct from target_header->>'target_message_count'
       or octet_length(target_metadata::text) > 20000 then
        raise exception 'invalid_three_gate_lineage' using errcode = '22023';
    end if;
    -- JSON content is limited to the validated wire manifest; no arbitrary text fields.
    if jsonb_typeof(target_metadata->'snapshot') <> 'object'
       or (select count(*) from jsonb_object_keys(target_metadata->'snapshot')) <> 9
       or exists (select 1 from jsonb_object_keys(target_metadata->'snapshot') k where k not in
         ('conversation_revision','cutoff_at_ms','message_count','ordered_segment_refs','message_revisions',
          'pending_count','coverage_gap','earliest_evidence_at_ms','latest_evidence_at_ms'))
       or jsonb_typeof(target_metadata->'gate_evidence') <> 'object'
       or (select count(*) from jsonb_object_keys(target_metadata->'gate_evidence')) <> 3
       or exists (select 1 from jsonb_object_keys(target_metadata->'gate_evidence') k
                  where k not in ('rule_version','evaluated_gates','reason_codes'))
       or target_metadata#>>'{gate_evidence,rule_version}' !~ '^[ -~]{1,80}$'
       or target_metadata#>'{gate_evidence,evaluated_gates}' is distinct from '[1,2,3]'::jsonb
       or exists (select 1 from jsonb_array_elements_text(target_metadata#>'{gate_evidence,reason_codes}') code
                  where code !~ '^[A-Z][A-Z0-9_]{0,63}$')
       or exists (select 1 from jsonb_array_elements_text(target_metadata#>'{snapshot,ordered_segment_refs}') ref
                  where ref !~ '^[A-Za-z0-9_-]{22}$') then
        raise exception 'invalid_three_gate_manifest' using errcode = '22023';
    end if;
    if jsonb_typeof(target_metadata#>'{snapshot,ordered_segment_refs}') is distinct from 'array'
       or jsonb_typeof(target_metadata#>'{snapshot,message_revisions}') is distinct from 'array'
       or jsonb_typeof(target_metadata#>'{gate_evidence,reason_codes}') is distinct from 'array'
       or jsonb_typeof(target_metadata#>'{snapshot,coverage_gap}') is distinct from 'boolean'
       or jsonb_array_length(target_metadata#>'{snapshot,ordered_segment_refs}') <> (target_header->>'target_message_count')::integer
       or jsonb_array_length(target_metadata#>'{snapshot,message_revisions}') <> (target_header->>'target_message_count')::integer
       or (select count(distinct ref) from jsonb_array_elements_text(target_metadata#>'{snapshot,ordered_segment_refs}') ref)
             <> (target_header->>'target_message_count')::integer
       or jsonb_array_length(target_metadata#>'{gate_evidence,reason_codes}') > 32
       or (select count(distinct code) from jsonb_array_elements_text(target_metadata#>'{gate_evidence,reason_codes}') code)
             <> jsonb_array_length(target_metadata#>'{gate_evidence,reason_codes}')
       or exists (select 1 from jsonb_array_elements(target_metadata#>'{snapshot,message_revisions}') revision_value
          where jsonb_typeof(revision_value) <> 'number' or (revision_value#>>'{}')::numeric < 1
            or (revision_value#>>'{}')::numeric > 9007199254740991
            or (revision_value#>>'{}')::numeric <> trunc((revision_value#>>'{}')::numeric))
       or exists (select 1 from unnest(array['conversation_revision','cutoff_at_ms','message_count','pending_count',
          'earliest_evidence_at_ms','latest_evidence_at_ms']) field
          where jsonb_typeof(target_metadata->'snapshot'->field) is distinct from 'number'
            or (target_metadata->'snapshot'->>field)::numeric < 0
            or (target_metadata->'snapshot'->>field)::numeric > 9007199254740991
            or (target_metadata->'snapshot'->>field)::numeric <> trunc((target_metadata->'snapshot'->>field)::numeric))
       or (target_metadata#>>'{snapshot,earliest_evidence_at_ms}')::bigint > (target_metadata#>>'{snapshot,latest_evidence_at_ms}')::bigint
       or (target_metadata#>>'{snapshot,latest_evidence_at_ms}')::bigint > cutoff
       or ((target_metadata#>>'{snapshot,pending_count}')::bigint > 0
           and target_metadata#>'{snapshot,coverage_gap}' <> 'true'::jsonb) then
      raise exception 'invalid_three_gate_manifest_shape' using errcode = '22023';
    end if;
    insert into public.v2_three_gate_cases(device_id,case_id,child_id,conversation_ref,privacy_identity_version)
      values(target_device_id,case_uuid,child,target_conversation_ref,privacy_version)
      on conflict (device_id,case_id) do nothing;
    select * into c from public.v2_three_gate_cases x
      where x.device_id = target_device_id and x.case_id = case_uuid for update;
    if c.child_id is distinct from child or c.conversation_ref is distinct from target_conversation_ref
       or c.privacy_identity_version is distinct from privacy_version then
        raise exception 'three_gate_case_scope_conflict' using errcode = '23505';
    end if;
    select * into a from public.v2_three_gate_assessments x
      where x.device_id = target_device_id and x.assessment_id = assessment_uuid;
    if a.incident_id is not null then
        if a.case_id is distinct from case_uuid or a.assessment_seq is distinct from seq
           or a.manifest is distinct from target_metadata then
            raise exception 'three_gate_assessment_conflict' using errcode = '23505';
        end if;
    elsif seq <= c.latest_submitted_seq
       or (previous_state = 'submitted' and
           (seq <> c.latest_submitted_seq + 1 or previous_uuid is distinct from c.latest_submitted_id))
       or (previous_state = 'cancelled_before_submission' and exists
           (select 1 from public.v2_safety_incidents known where known.device_id = target_device_id
            and known.client_incident_id = previous_uuid))
       or revision <= c.latest_conversation_revision or cutoff < c.latest_cutoff_at_ms then
        raise exception 'three_gate_sequence_conflict' using errcode = '23505';
    end if;
    select * into b from public.v2_begin_ephemeral_incident_analysis_service(
      target_device_id, assessment_uuid, target_header->>'target_category', target_header->>'target_severity',
      target_header->>'target_child_role', (target_header->>'target_confidence')::real,
      (target_header->>'target_capture_quality')::real, (target_header->>'target_occurred_at')::timestamptz,
      (target_header->>'target_model_contract_version')::smallint,
      (target_header->>'target_privacy_contract_version')::smallint, privacy_version,
      (target_header->>'target_key_version')::integer, (target_header->>'target_message_count')::smallint,
      (target_header->>'target_context_expires_at')::timestamptz,
      target_header->>'target_submission_hash_hex', (target_header->>'target_lease_seconds')::integer);
    if a.incident_id is null then
      -- A pre-existing legacy incident cannot be adopted into a new case.
      if not b.created then raise exception 'three_gate_legacy_identity_conflict' using errcode = '23505'; end if;
      insert into public.v2_three_gate_assessments(incident_id,device_id,case_id,assessment_id,assessment_seq,
          previous_assessment_id,manifest) values(b.incident_id,target_device_id,case_uuid,assessment_uuid,seq,
          previous_uuid,target_metadata);
      update public.v2_three_gate_cases x set latest_submitted_seq = seq, latest_submitted_id = assessment_uuid,
        latest_conversation_revision = revision, latest_cutoff_at_ms = cutoff, updated_at = now()
        where x.device_id = target_device_id and x.case_id = case_uuid;
    end if;
    return query select b.incident_id,b.created,b.analysis_state,b.lease_token,b.incident_status,
       b.analysis_outcome,b.delivery_count,case when a.incident_id is not null then a.parent_incident_id else c.parent_incident_id end;
end;
$$;

create function public.v2_get_three_gate_assessment_receipt_service(
    target_device_id uuid, target_case_id uuid, target_assessment_id uuid, target_assessment_seq bigint
) returns table (receipt_state text, incident_id uuid, created boolean, analysis_outcome text,
    expert_outcome text, case_id uuid, assessment_id uuid, assessment_seq bigint,
    message_count integer, payload_digest text, parent_alert_created boolean)
language plpgsql security definer set search_path = '' as $$
declare a public.v2_three_gate_assessments%rowtype; child uuid;
begin
    if target_device_id is null or target_case_id is null or target_assessment_id is null
       or target_assessment_seq is null or target_assessment_seq not between 1 and 9007199254740991 then
      raise exception 'invalid_assessment_receipt_query' using errcode = '22023'; end if;
    select d.child_id into child from public.v2_protected_devices d
      where d.id=target_device_id and d.status in ('active','degraded');
    if child is null then raise exception 'device_not_active' using errcode = '42501'; end if;
    select x.* into a from public.v2_three_gate_assessments x
      join public.v2_three_gate_cases c on c.device_id=x.device_id and c.case_id=x.case_id
      where x.device_id=target_device_id and x.case_id=target_case_id
        and x.assessment_id=target_assessment_id and x.assessment_seq=target_assessment_seq and c.child_id=child;
    if a.incident_id is null then
      return query select 'not_found'::text,null::uuid,false,null::text,null::text,
        target_case_id,target_assessment_id,target_assessment_seq,null::integer,null::text,false;
    elsif a.outcome is null then
      return query select 'pending'::text,null::uuid,false,null::text,null::text,
        target_case_id,target_assessment_id,target_assessment_seq,null::integer,null::text,false;
    else
      return query select 'completed'::text,coalesce(a.parent_incident_id,a.incident_id),false,a.outcome,a.outcome,
        a.case_id,a.assessment_id,a.assessment_seq,(a.manifest#>>'{snapshot,message_count}')::integer,
        a.manifest->>'payload_digest',a.delivery_count > 0;
    end if;
end;
$$;

create function public.v2_finalize_three_gate_assessment_service(
    target_incident_id uuid, target_lease_token text, target_analysis jsonb,
    target_model_version text, target_prompt_version text
) returns table (incident_status text, analysis_outcome text, delivery_count integer, parent_incident_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
    a public.v2_three_gate_assessments%rowtype; c public.v2_three_gate_cases%rowtype;
    r public.v2_ephemeral_incident_receipts%rowtype;
    result record; outcome text; category text; severity text; urgency text; role_value text;
    pattern_value text; confidence real; refs text[]; secondary text[]; channels text[];
    reason text; action text; request_hash bytea; lease_hash bytea; rank_value integer;
    count_value integer := 0; parent_id uuid; status_value text := 'assessed';
begin
    if target_analysis is null or jsonb_typeof(target_analysis) <> 'object'
       or (select count(*) from jsonb_object_keys(target_analysis)) <> 9
       or exists (select 1 from jsonb_object_keys(target_analysis) k where k not in
          ('outcome','primary_category','secondary_categories','severity','urgency','child_role','pattern','confidence','evidence_segment_refs'))
       or target_lease_token is null or target_lease_token !~ '^[0-9a-f]{64}$'
       or target_model_version is null or target_model_version not in ('gpt-5.6-luna','gpt-5.4-nano','gpt-5.4-nano-2026-03-17')
       or target_prompt_version is distinct from 'kippy-expert-v5' then
        raise exception 'invalid_three_gate_analysis' using errcode = '22023';
    end if;
    outcome := target_analysis->>'outcome'; category := target_analysis->>'primary_category';
    severity := target_analysis->>'severity'; urgency := target_analysis->>'urgency';
    role_value := target_analysis->>'child_role'; pattern_value := target_analysis->>'pattern';
    confidence := (target_analysis->>'confidence')::real;
    refs := array(select jsonb_array_elements_text(target_analysis->'evidence_segment_refs'));
    secondary := array(select jsonb_array_elements_text(target_analysis->'secondary_categories'));
    if outcome is null or outcome not in ('confirmed','dismissed','inconclusive')
       or urgency is null or urgency not in ('routine','elevated','immediate')
       or role_value is null or role_value not in ('child','target','participant','initiator','unknown')
       or role_value = 'child'
       or pattern_value is null or pattern_value not in ('isolated','repeated','escalating','unknown')
       or confidence is null or confidence not between 0 and 1
       or not public.v2_valid_segment_refs(refs)
       or not public.v2_valid_expert_secondary_categories(category,secondary)
       or (category is not null and category not in ('bullying','exclusion','sexual_content','violence','grooming','manipulation','stranger_contact','self_harm','other'))
       or (severity is not null and severity not in ('low','medium','high','critical'))
       or (outcome = 'confirmed' and (category is null or severity is null or confidence < 0.6))
       or (outcome = 'dismissed' and (category is not null or severity is not null or confidence < 0.8
              or cardinality(secondary) <> 0 or urgency <> 'routine' or role_value <> 'unknown')) then
        raise exception 'invalid_three_gate_analysis' using errcode = '22023';
    end if;
    select * into a from public.v2_three_gate_assessments x where x.incident_id = target_incident_id;
    if a.incident_id is null then raise exception 'three_gate_assessment_not_found' using errcode = '42501'; end if;
    -- Every begin/finalize locks case before receipt, so concurrent linked assessments cannot deadlock.
    select * into c from public.v2_three_gate_cases x
      where x.device_id = a.device_id and x.case_id = a.case_id for update;
    select * into a from public.v2_three_gate_assessments x where x.incident_id = target_incident_id for update;
    select * into r from public.v2_ephemeral_incident_receipts x where x.incident_id = target_incident_id for update;
    lease_hash := extensions.digest(convert_to(target_lease_token,'UTF8'),'sha256');
    request_hash := extensions.digest(convert_to(jsonb_build_object('analysis',target_analysis,
       'model',target_model_version,'prompt',target_prompt_version)::text,'UTF8'),'sha256');
    if a.outcome is not null then
      if a.completion_lease_hash is distinct from lease_hash or a.completion_hash is distinct from request_hash then
        raise exception 'three_gate_completion_conflict' using errcode = '23505'; end if;
      return query select r.completion_incident_status,a.outcome,a.delivery_count,a.parent_incident_id;
      return;
    end if;
    if r.state <> 'leased' or r.lease_token_hash is distinct from lease_hash
       or r.lease_expires_at <= now() or r.context_expires_at <= now()
       or not exists (select 1 from public.v2_protected_devices d where d.id = a.device_id
                      and d.child_id = c.child_id and d.status in ('active','degraded')) then
      raise exception 'invalid_or_expired_analysis_lease' using errcode = '42501'; end if;
    if exists (select 1 from unnest(refs) ref where not (a.manifest#>'{snapshot,ordered_segment_refs}') ? ref) then
      raise exception 'three_gate_analysis_evidence_mismatch' using errcode = '22023'; end if;
    parent_id := c.parent_incident_id;
    rank_value := case severity when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 else 0 end;
    -- A newer inconclusive/dismissed result cannot erase a late first confirmation.
    -- Establish its history, while the latest-assessment projection still stays monotonic.
    if outcome = 'confirmed' and parent_id is null then
      reason := public.v2_v3_reason_for_inference(outcome,category);
      action := public.v2_v3_action_for_inference(outcome,category,severity,urgency);
      channels := public.v2_v3_channels_for_inference(outcome,severity,urgency);
      select * into result from public.v2_finalize_ephemeral_incident_analysis_service(target_incident_id,
        target_lease_token,outcome,reason,action,target_model_version,category,secondary,severity,urgency,
        role_value,pattern_value,confidence,refs,channels,target_prompt_version);
      parent_id := target_incident_id; count_value := result.delivery_count; status_value := result.incident_status;
      update public.v2_three_gate_cases x set parent_incident_id = parent_id,
        first_confirmed_seq = a.assessment_seq,
        highest_confirmed_severity = greatest(x.highest_confirmed_severity,rank_value), updated_at = now()
        where x.device_id = a.device_id and x.case_id = a.case_id;
    elsif outcome = 'confirmed' and a.assessment_seq > c.latest_applied_seq
          and rank_value > c.highest_confirmed_severity then
      channels := public.v2_v3_channels_for_inference(outcome,severity,urgency);
      insert into public.v2_alert_deliveries (
        incident_id,guardian_user_id,channel,idempotency_key,event_key,event_assessment_id
      )
      select parent_id,m.guardian_user_id,ch.channel,
        'three-gate:'||parent_id::text||':severity:'||rank_value::text||':'||m.guardian_user_id::text||':'||ch.channel,
        'three-gate-severity:'||rank_value::text,target_incident_id
      from public.v2_children child
      join public.v2_guardian_memberships m on m.family_id=child.family_id and m.status='active'
      cross join unnest(channels) ch(channel)
      where child.id=c.child_id
      on conflict (incident_id,guardian_user_id,channel,event_key) do nothing;
      get diagnostics count_value = row_count;
    end if;
    if outcome = 'confirmed' then
      update public.v2_three_gate_cases x set
        highest_confirmed_severity=greatest(x.highest_confirmed_severity,rank_value)
        where x.device_id=a.device_id and x.case_id=a.case_id;
    end if;
    update public.v2_three_gate_assessments x set outcome = target_analysis->>'outcome',
      analysis = target_analysis, model_version = target_model_version, prompt_version = target_prompt_version,
      completion_hash = request_hash, completion_lease_hash = lease_hash, parent_incident_id = parent_id,
      delivery_count = count_value, completed_at = now() where x.incident_id = target_incident_id;
    if status_value = 'assessed' then
      update public.v2_safety_incidents x set status = 'assessed' where x.id = target_incident_id;
      update public.v2_ephemeral_incident_receipts x set state = 'completed',
        lease_token_hash = null, lease_expires_at = null, completion_request_hash = request_hash,
        completion_lease_token_hash = lease_hash, completion_incident_status = 'assessed',
        completion_analysis_outcome = outcome, completion_delivery_count = count_value, completed_at = now()
        where x.incident_id = target_incident_id;
    end if;
    if a.assessment_seq > c.latest_applied_seq then
      update public.v2_three_gate_cases x set latest_applied_seq = a.assessment_seq,
        latest_outcome = outcome, latest_analysis = target_analysis, parent_incident_id = parent_id,
        first_confirmed_seq = case when parent_id is not null then coalesce(x.first_confirmed_seq,a.assessment_seq) end,
        highest_confirmed_severity = case when outcome = 'confirmed' then greatest(x.highest_confirmed_severity,rank_value)
                                         else x.highest_confirmed_severity end,
        updated_at = now() where x.device_id = a.device_id and x.case_id = a.case_id;
    end if;
    return query select status_value,outcome,count_value,parent_id;
end;
$$;

-- Guardian reads receive only current parent-safe projection, never manifest or internal references.
create function public.v2_get_guardian_three_gate_projections(target_incident_ids uuid[])
returns table (incident_id uuid, assessment_seq bigint, expert_outcome text, expert_category text,
    expert_severity text, expert_child_role text, expert_confidence real,
    safe_summary text, safe_reason text, recommended_action text)
language sql stable security definer set search_path = '' as $$
 select c.parent_incident_id,c.latest_applied_seq,c.latest_outcome,
   case when c.latest_outcome='confirmed' then c.latest_analysis->>'primary_category' end,
   case when c.latest_outcome='confirmed' then c.latest_analysis->>'severity' end,
   case when c.latest_outcome='confirmed' then c.latest_analysis->>'child_role' end,
   case when c.latest_outcome='confirmed' then (c.latest_analysis->>'confidence')::real end,
   case c.latest_outcome when 'confirmed' then public.v2_parent_summary_template(c.latest_analysis->>'primary_category')
     when 'dismissed' then 'בבדיקה העדכנית לא נמצא בסיס להתראה נוספת. האירוע הקודם נשמר למעקב.'
     else 'הבדיקה העדכנית לא אפשרה הכרעה. האירוע הקודם נשמר למעקב.' end,
   case c.latest_outcome when 'confirmed' then public.v2_parent_reason_template(
       public.v2_v3_reason_for_inference('confirmed',c.latest_analysis->>'primary_category'))
     when 'dismissed' then 'התוצאה מתייחסת להקשר שנבדק כעת ואינה מוחקת את ההערכה הקודמת.'
     else 'אין בתוצאה זו אישור לבטיחות או קביעה חדשה שנמצאה פגיעה.' end,
   case c.latest_outcome when 'confirmed' then public.v2_parent_action_template(
       public.v2_v3_action_for_inference('confirmed',c.latest_analysis->>'primary_category',
         c.latest_analysis->>'severity',c.latest_analysis->>'urgency'))
     else original.recommended_action end
 from public.v2_three_gate_cases c
 join public.v2_incident_analysis original on original.incident_id = c.parent_incident_id
 where c.parent_incident_id = any(target_incident_ids) and cardinality(target_incident_ids) <= 250
   and public.v2_guardian_can_read_confirmed_incident(c.parent_incident_id);
$$;

revoke all on function public.v2_guard_three_gate_assessment() from public,anon,authenticated;
revoke all on function public.v2_begin_three_gate_assessment_service(uuid,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.v2_finalize_three_gate_assessment_service(uuid,text,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.v2_get_three_gate_assessment_receipt_service(uuid,uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.v2_get_guardian_three_gate_projections(uuid[]) from public,anon,authenticated;
grant execute on function public.v2_begin_three_gate_assessment_service(uuid,jsonb,jsonb,text) to service_role;
grant execute on function public.v2_finalize_three_gate_assessment_service(uuid,text,jsonb,text,text) to service_role;
grant execute on function public.v2_get_three_gate_assessment_receipt_service(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.v2_get_guardian_three_gate_projections(uuid[]) to authenticated;
comment on table public.v2_three_gate_cases is 'Service-only content-free case lineage and latest assessment projection. Parent incident identity and immutable first-confirmed analysis remain stable.';
comment on table public.v2_three_gate_assessments is 'Immutable terminal assessments, including inconclusive. No transcript, ciphertext, digest key, prompt or excerpts. The legacy receipt protects exact encrypted retries.';

commit;
