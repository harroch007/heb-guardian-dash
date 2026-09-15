begin;

-- Forward-only widening of the existing case contract. Do not rewrite its
-- identity, lineage, scope, lease, privacy, finalization or delivery policy.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.v2_begin_three_gate_assessment_service(uuid,jsonb,jsonb,text)'::regprocedure);
  if position($old$target_metadata->>'contract_version' is distinct from 'THREE_GATE_FULL_FIFO_V1'$old$ in definition) = 0
     or position($old$target_metadata#>'{gate_evidence,evaluated_gates}' is distinct from '[1,2,3]'::jsonb$old$ in definition) = 0 then
    raise exception 'moderation_context_existing_contract_drift';
  end if;
  definition := replace(definition,
    $old$target_metadata->>'contract_version' is distinct from 'THREE_GATE_FULL_FIFO_V1'$old$,
    $new$(target_metadata->>'contract_version' is null or target_metadata->>'contract_version' not in ('THREE_GATE_FULL_FIFO_V1','MODERATION_CONTEXT_FIFO_V1'))$new$);
  definition := replace(definition,
    $old$target_metadata#>'{gate_evidence,evaluated_gates}' is distinct from '[1,2,3]'::jsonb$old$,
    $new$not coalesce((
      (target_metadata->>'contract_version' = 'THREE_GATE_FULL_FIFO_V1'
       and target_metadata#>'{gate_evidence,evaluated_gates}' = '[1,2,3]'::jsonb)
      or (target_metadata->>'contract_version' = 'MODERATION_CONTEXT_FIFO_V1' and (
        (target_metadata#>'{gate_evidence,evaluated_gates}' = '[1]'::jsonb
         and exists (select 1 from jsonb_array_elements_text(target_metadata#>'{gate_evidence,reason_codes}') reason where reason like 'MODERATION\_%' escape '\'))
        or (target_metadata#>'{gate_evidence,evaluated_gates}' = '[]'::jsonb
            and target_metadata#>'{gate_evidence,reason_codes}' @> '["LAZY_CONTEXT_REVIEW"]'::jsonb)
      ))
    ),false)$new$);
  execute definition;
end;
$migration$;

create table public.v2_moderation_batch_receipts (
  device_id uuid not null references public.v2_protected_devices(id) on delete cascade,
  request_id uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  conversation_ref text not null check (conversation_ref ~ '^[A-Za-z0-9_-]{16,128}$'),
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  state text not null check (state in ('received','leased','completed')),
  lease_token_hash bytea,
  lease_expires_at timestamptz,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (device_id,request_id),
  check ((state='leased' and lease_token_hash is not null and lease_expires_at is not null)
      or (state<>'leased' and lease_token_hash is null and lease_expires_at is null)),
  check ((state='completed' and response is not null) or (state<>'completed' and response is null))
);
comment on table public.v2_moderation_batch_receipts is
  '24-hour content-free moderation result/lease receipts. Only opaque IDs, keyed request digest, versions, scores and codes. No messages, quotes, prompts, names or provider bodies.';
create index v2_moderation_receipt_expiry on public.v2_moderation_batch_receipts(expires_at);
alter table public.v2_moderation_batch_receipts enable row level security;
alter table public.v2_moderation_batch_receipts force row level security;
revoke all on public.v2_moderation_batch_receipts from public,anon,authenticated,service_role;

create function public.v2_begin_moderation_batch_service(
  target_device_id uuid, target_request_id uuid, target_request_hash text,
  target_conversation_ref text, target_source_revision text
) returns table(receipt_state text, lease_token text, response jsonb)
language plpgsql security definer set search_path='' as $$
declare r public.v2_moderation_batch_receipts%rowtype; token text;
begin
  if target_device_id is null or target_request_id is null
     or target_request_hash is null or target_request_hash !~ '^[0-9a-f]{64}$'
     or target_conversation_ref is null or target_conversation_ref !~ '^[A-Za-z0-9_-]{16,128}$'
     or target_source_revision is null or target_source_revision !~ '^[0-9a-f]{64}$'
     or not exists(select 1 from public.v2_protected_devices d join public.v2_children c on c.id=d.child_id
       join public.v2_families f on f.id=c.family_id where d.id=target_device_id and d.status in ('active','degraded')
       and c.status='active' and f.status='active') then
    raise exception 'invalid_moderation_request' using errcode='22023';
  end if;
  delete from public.v2_moderation_batch_receipts x where x.device_id=target_device_id and x.expires_at<=now();
  insert into public.v2_moderation_batch_receipts(device_id,request_id,request_hash,conversation_ref,source_revision,state)
  values(target_device_id,target_request_id,target_request_hash,target_conversation_ref,target_source_revision,'received')
  on conflict(device_id,request_id) do nothing;
  select * into r from public.v2_moderation_batch_receipts x
    where x.device_id=target_device_id and x.request_id=target_request_id for update;
  if r.request_hash<>target_request_hash or r.conversation_ref<>target_conversation_ref or r.source_revision<>target_source_revision then
    raise exception 'moderation_idempotency_conflict' using errcode='23505';
  end if;
  if r.state='completed' then return query select 'completed'::text,null::text,r.response; return; end if;
  if r.state='leased' and r.lease_expires_at>now() then return query select 'busy'::text,null::text,null::jsonb; return; end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  update public.v2_moderation_batch_receipts x set state='leased',
    lease_token_hash=extensions.digest(token,'sha256'),lease_expires_at=now()+interval '45 seconds'
    where x.device_id=target_device_id and x.request_id=target_request_id;
  return query select 'leased'::text,token,null::jsonb;
end; $$;

create function public.v2_complete_moderation_batch_service(
  target_device_id uuid,target_request_id uuid,target_lease_token text,target_response jsonb
) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.v2_moderation_batch_receipts%rowtype;
begin
  if target_lease_token is null or target_lease_token !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(target_response) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(target_response))<>11
     or exists(select 1 from jsonb_object_keys(target_response) k where k not in
       ('request_id','source_revision','model','policy_version','flagged','categories','category_scores','escalate','trigger_codes','elapsed_ms','cached'))
     or target_response->>'request_id' is distinct from target_request_id::text
     or target_response->>'model' is null or target_response->>'model' !~ '^[A-Za-z0-9._-]{1,100}$'
     or target_response->>'policy_version' is null or target_response->>'policy_version' !~ '^[A-Za-z0-9._-]{1,80}$'
     or jsonb_typeof(target_response->'categories') is distinct from 'object'
     or jsonb_typeof(target_response->'category_scores') is distinct from 'object'
     or jsonb_typeof(target_response->'flagged') is distinct from 'boolean'
     or jsonb_typeof(target_response->'escalate') is distinct from 'boolean'
     or target_response->'cached' is distinct from 'false'::jsonb
     or jsonb_typeof(target_response->'trigger_codes') is distinct from 'array'
     or jsonb_typeof(target_response->'elapsed_ms') is distinct from 'number' then
    raise exception 'invalid_moderation_completion' using errcode='22023';
  end if;
  if (target_response->>'elapsed_ms')::numeric not between 0 and 600000
     or (select count(*) from jsonb_object_keys(target_response->'categories')) not between 1 and 32
     or (select count(*) from jsonb_object_keys(target_response->'category_scores')) not between 1 and 32
     or exists(select 1 from jsonb_each(target_response->'categories') p where p.key !~ '^[a-z][a-z/-]{0,63}$' or jsonb_typeof(p.value)<>'boolean')
     or exists(select 1 from jsonb_each(target_response->'category_scores') p where p.key !~ '^[a-z][a-z/-]{0,63}$'
        or jsonb_typeof(p.value)<>'number')
     or jsonb_array_length(target_response->'trigger_codes')>32
     or exists(select 1 from jsonb_array_elements_text(target_response->'trigger_codes') c where c !~ '^[A-Z][A-Z0-9_]{0,63}$') then
    raise exception 'invalid_moderation_completion' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(target_response->'category_scores') p where (p.value::text)::numeric not between 0 and 1) then
    raise exception 'invalid_moderation_scores' using errcode='22023';
  end if;
  select * into r from public.v2_moderation_batch_receipts x where x.device_id=target_device_id and x.request_id=target_request_id for update;
  if r.device_id is null or r.state<>'leased' or r.lease_expires_at<=now() or r.expires_at<=now()
     or r.lease_token_hash is distinct from extensions.digest(target_lease_token,'sha256')
     or target_response->>'source_revision' is distinct from r.source_revision then
    raise exception 'invalid_moderation_lease' using errcode='42501';
  end if;
  update public.v2_moderation_batch_receipts x set state='completed',response=target_response,lease_token_hash=null,lease_expires_at=null
    where x.device_id=target_device_id and x.request_id=target_request_id;
  return true;
end; $$;

create function public.v2_release_moderation_batch_service(target_device_id uuid,target_request_id uuid,target_lease_token text)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.v2_moderation_batch_receipts x set state='received',lease_token_hash=null,lease_expires_at=null
  where x.device_id=target_device_id and x.request_id=target_request_id and x.state='leased'
    and x.lease_token_hash=extensions.digest(target_lease_token,'sha256');
  get diagnostics changed=row_count; return changed=1;
end; $$;

create function public.v2_cleanup_moderation_receipts_internal() returns bigint
language plpgsql security definer set search_path='' as $$
declare deleted bigint;
begin
  delete from public.v2_moderation_batch_receipts where expires_at<=now();
  get diagnostics deleted=row_count; return deleted;
end; $$;
revoke all on function public.v2_begin_moderation_batch_service(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.v2_complete_moderation_batch_service(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.v2_release_moderation_batch_service(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.v2_cleanup_moderation_receipts_internal() from public,anon,authenticated,service_role;
grant execute on function public.v2_begin_moderation_batch_service(uuid,uuid,text,text,text) to service_role;
grant execute on function public.v2_complete_moderation_batch_service(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.v2_release_moderation_batch_service(uuid,uuid,text) to service_role;
select cron.schedule('v2-moderation-receipt-cleanup','*/15 * * * *','select public.v2_cleanup_moderation_receipts_internal();');
commit;
