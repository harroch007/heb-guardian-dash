begin;

-- Additive guardian workflow metadata. Expert finalizers and immutable analysis
-- bodies are unchanged; the completion trigger participates in their transaction.
alter table public.v2_three_gate_cases add column attention_assessment_seq bigint not null default 0
  check (attention_assessment_seq >= 0);
alter table public.v2_guardian_incident_states
  add column state_version bigint not null default 0 check (state_version >= 0),
  add column acknowledged_assessment_seq bigint check (acknowledged_assessment_seq > 0),
  add column last_acknowledged_at timestamptz;
alter table public.v2_safety_incidents add column updated_at timestamptz;
update public.v2_safety_incidents set updated_at=received_at;
alter table public.v2_safety_incidents alter column updated_at set default now(),
  alter column updated_at set not null;
create index v2_incidents_child_status_updated on public.v2_safety_incidents
  (child_id,status,updated_at desc,occurred_at desc);

create table public.v2_guardian_case_attention_events (
  incident_id uuid not null references public.v2_safety_incidents(id) on delete cascade,
  assessment_seq bigint not null check (assessment_seq > 0),
  assessment_incident_id uuid not null unique references public.v2_three_gate_assessments(incident_id) on delete cascade,
  occurred_at timestamptz not null,
  primary key (incident_id,assessment_seq)
);
create table public.v2_guardian_case_state_requests (
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  request_key_hash bytea not null,
  incident_id uuid not null references public.v2_safety_incidents(id) on delete cascade,
  request_hash bytea not null,
  applied_assessment_seq bigint not null,
  applied_state_version bigint not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (guardian_user_id,request_key_hash)
);
alter table public.v2_guardian_case_attention_events enable row level security;
alter table public.v2_guardian_case_attention_events force row level security;
alter table public.v2_guardian_case_state_requests enable row level security;
alter table public.v2_guardian_case_state_requests force row level security;
revoke all on public.v2_guardian_case_attention_events,public.v2_guardian_case_state_requests
  from public,anon,authenticated;

-- Backfill ONLY evidence of an actual first confirmation or escalation event.
insert into public.v2_guardian_case_attention_events
  (incident_id,assessment_seq,assessment_incident_id,occurred_at)
select c.parent_incident_id,a.assessment_seq,a.incident_id,a.completed_at
from public.v2_three_gate_cases c join public.v2_three_gate_assessments a
  on a.device_id=c.device_id and a.case_id=c.case_id
where c.parent_incident_id is not null and a.outcome='confirmed' and
 (a.assessment_seq=c.first_confirmed_seq or exists (
   select 1 from public.v2_alert_deliveries d where d.incident_id=c.parent_incident_id
     and d.event_assessment_id=a.incident_id and d.event_key like 'three-gate-severity:%'));
update public.v2_three_gate_cases c set attention_assessment_seq=coalesce((
 select max(e.assessment_seq) from public.v2_guardian_case_attention_events e
 where e.incident_id=c.parent_incident_id),0);
update public.v2_safety_incidents i set updated_at=greatest(i.updated_at,a.completed_at,first_assessment.completed_at)
from public.v2_three_gate_cases c join public.v2_three_gate_assessments a
 on a.device_id=c.device_id and a.case_id=c.case_id and a.assessment_seq=c.latest_applied_seq
left join public.v2_three_gate_assessments first_assessment
 on first_assessment.device_id=c.device_id and first_assessment.case_id=c.case_id
 and first_assessment.assessment_seq=c.first_confirmed_seq
where i.id=c.parent_incident_id;
update public.v2_guardian_incident_states s set last_acknowledged_at=s.acknowledged_at
where exists(select 1 from public.v2_three_gate_cases c where c.parent_incident_id=s.incident_id);
-- Old acknowledgments are unversioned: retain their timestamp but do not invent
-- an assessment version. Reopen when an actual attention event followed them.
update public.v2_guardian_incident_states s set state='new',state_version=s.state_version+1,
  saved_at=null,acknowledged_at=null
where s.state in ('saved','acknowledged') and exists (
 select 1 from public.v2_guardian_case_attention_events e where e.incident_id=s.incident_id
 and e.occurred_at > case when s.state='acknowledged' then coalesce(s.acknowledged_at,s.updated_at)
                         else s.updated_at end);

create function public.v2_apply_guardian_case_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  c public.v2_three_gate_cases%rowtype;
  prior_rank integer; current_rank integer; first_confirmation boolean; attention_event boolean;
begin
  select * into c from public.v2_three_gate_cases x
    where x.device_id=new.device_id and x.case_id=new.case_id for update;
  if c.parent_incident_id is null then return new; end if;
  first_confirmation := new.outcome='confirmed' and c.first_confirmed_seq=new.assessment_seq
    and c.parent_incident_id=new.incident_id;
  -- updated_at is display recency only. Status/occurred_at/first analysis remain intact.
  if first_confirmation or new.assessment_seq > c.latest_applied_seq then
    update public.v2_safety_incidents i set updated_at=greatest(i.updated_at,new.completed_at)
      where i.id=c.parent_incident_id;
  end if;
  if new.outcome <> 'confirmed' then return new; end if;
  current_rank := case new.analysis->>'severity'
    when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 else 0 end;
  -- The finalizer already incorporated this result in c.highest_confirmed_severity.
  -- OTHER completed results, including late ones, reproduce its prior maximum.
  select coalesce(max(case a.analysis->>'severity'
    when 'low' then 1 when 'medium' then 2 when 'high' then 3 when 'critical' then 4 else 0 end),0)
    into prior_rank from public.v2_three_gate_assessments a
    where a.device_id=new.device_id and a.case_id=new.case_id
      and a.incident_id<>new.incident_id and a.outcome='confirmed';
  attention_event := first_confirmation or
    (new.assessment_seq > c.latest_applied_seq and current_rank > prior_rank);
  if attention_event then
    insert into public.v2_guardian_case_attention_events
      (incident_id,assessment_seq,assessment_incident_id,occurred_at)
    values(c.parent_incident_id,new.assessment_seq,new.incident_id,new.completed_at)
    on conflict (incident_id,assessment_seq) do nothing;
    if found then
      update public.v2_three_gate_cases x
        set attention_assessment_seq=greatest(x.attention_assessment_seq,new.assessment_seq)
        where x.device_id=new.device_id and x.case_id=new.case_id;
      update public.v2_guardian_incident_states s
        set state='new',state_version=s.state_version+1,saved_at=null,acknowledged_at=null,
            last_acknowledged_at=coalesce(s.last_acknowledged_at,s.acknowledged_at)
        where s.incident_id=c.parent_incident_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger v2_guardian_case_completed after update of outcome on public.v2_three_gate_assessments
for each row when (old.outcome is null and new.outcome is not null)
execute function public.v2_apply_guardian_case_completion();

create function public.v2_get_guardian_case_summaries(target_incident_ids uuid[])
returns table (
 incident_id uuid,assessment_seq bigint,expert_outcome text,expert_category text,expert_severity text,
 expert_child_role text,expert_confidence real,safe_summary text,safe_reason text,recommended_action text,
 latest_assessment_at timestamptz,history_assessment_count bigint,attention_assessment_seq bigint,acknowledged_assessment_seq bigint,
 acknowledged_at timestamptz,guardian_state text,guardian_state_version bigint,
 guardian_state_updated_at timestamptz,case_details_available boolean,conversation_label text,conversation_type text
)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'guardian_authentication_required' using errcode='42501'; end if;
 if target_incident_ids is null or cardinality(target_incident_ids)>250 then
   raise exception 'invalid_guardian_case_query' using errcode='22023'; end if;
 return query
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
         c.latest_analysis->>'severity',c.latest_analysis->>'urgency')) else original.recommended_action end,
   a.completed_at,(select count(*) from public.v2_three_gate_assessments history
     where history.device_id=c.device_id and history.case_id=c.case_id
       and history.outcome is not null and history.assessment_seq<=c.latest_applied_seq),
   c.attention_assessment_seq,s.acknowledged_assessment_seq,
   coalesce(s.last_acknowledged_at,s.acknowledged_at),coalesce(s.state,'new'),coalesce(s.state_version,0),
   s.updated_at,true,null::text,null::text
 from public.v2_three_gate_cases c
 join public.v2_incident_analysis original on original.incident_id=c.parent_incident_id
 join public.v2_three_gate_assessments a on a.device_id=c.device_id and a.case_id=c.case_id
   and a.assessment_seq=c.latest_applied_seq and a.outcome is not null
 left join public.v2_guardian_incident_states s on s.incident_id=c.parent_incident_id and s.guardian_user_id=auth.uid()
 where c.parent_incident_id=any(target_incident_ids)
   and public.v2_guardian_can_read_confirmed_incident(c.parent_incident_id)
   and public.v2_guardian_has_active_child(c.child_id);
end;
$$;

create function public.v2_get_guardian_case_history(target_incident_id uuid,target_through_seq bigint,target_expected_count bigint,
 target_after_seq bigint default 0,target_limit integer default 50)
returns table (incident_id uuid,through_seq bigint,assessments jsonb,next_after_seq bigint,has_more boolean)
language plpgsql stable security definer set search_path='' as $$
declare c public.v2_three_gate_cases%rowtype;
begin
 if auth.uid() is null or not public.v2_guardian_can_read_confirmed_incident(target_incident_id) then
   raise exception 'guardian_incident_access_denied' using errcode='42501'; end if;
 select * into c from public.v2_three_gate_cases x where x.parent_incident_id=target_incident_id;
 if c.parent_incident_id is null or not public.v2_guardian_has_active_child(c.child_id) then
   raise exception 'guardian_incident_access_denied' using errcode='42501'; end if;
 if target_through_seq is null or target_through_seq<1 or target_through_seq>c.latest_applied_seq
    or target_expected_count is null or target_expected_count<0
    or target_after_seq is null or target_after_seq<0 or target_after_seq>target_through_seq
    or target_limit is null or target_limit not between 1 and 100 then
   raise exception 'invalid_guardian_case_history_page' using errcode='22023'; end if;
 -- Terminal rows are immutable. A captured count detects a previously pending
 -- lower sequence completing between pages; newer sequences do not invalidate it.
 if target_expected_count<>(select count(*) from public.v2_three_gate_assessments a
   where a.device_id=c.device_id and a.case_id=c.case_id and a.outcome is not null
     and a.assessment_seq<=target_through_seq) then
   raise exception 'guardian_history_snapshot_conflict' using errcode='23505'; end if;
 return query
 with selected as (
   select a.* from public.v2_three_gate_assessments a
   where a.device_id=c.device_id and a.case_id=c.case_id and a.outcome is not null
     and a.assessment_seq>target_after_seq and a.assessment_seq<=target_through_seq
   order by a.assessment_seq limit target_limit+1
 ), page as (select * from selected order by assessment_seq limit target_limit),
 original as (
   select i.recommended_action,a.completed_at from public.v2_incident_analysis i
   join public.v2_three_gate_assessments a on a.incident_id=i.incident_id
   where i.incident_id=target_incident_id
 )
 select target_incident_id,target_through_seq,
 coalesce(jsonb_agg(jsonb_build_object(
   'assessment_seq',p.assessment_seq,'assessment_state','completed','completed_at',p.completed_at,
   'expert_outcome',p.outcome,
   'expert_category',case when p.outcome='confirmed' then p.analysis->>'primary_category' end,
   'expert_severity',case when p.outcome='confirmed' then p.analysis->>'severity' end,
   'expert_child_role',case when p.outcome='confirmed' then p.analysis->>'child_role' end,
   'expert_confidence',case when p.outcome='confirmed' then (p.analysis->>'confidence')::real end,
   'safe_summary',case p.outcome when 'confirmed' then public.v2_parent_summary_template(p.analysis->>'primary_category')
      when 'dismissed' then 'בבדיקה זו לא נמצא בסיס להתראה נוספת.' else 'בדיקה זו לא אפשרה הכרעה.' end,
   'safe_reason',case p.outcome when 'confirmed' then public.v2_parent_reason_template(
      public.v2_v3_reason_for_inference('confirmed',p.analysis->>'primary_category'))
      when 'dismissed' then 'התוצאה מתייחסת להקשר שנבדק ואינה מוחקת הערכות קודמות.'
      else 'אין בתוצאה זו אישור לבטיחות או קביעה חדשה שנמצאה פגיעה.' end,
   'recommended_action',case when p.outcome='confirmed' then public.v2_parent_action_template(
      public.v2_v3_action_for_inference('confirmed',p.analysis->>'primary_category',p.analysis->>'severity',p.analysis->>'urgency'))
      when p.completed_at>=o.completed_at then o.recommended_action
      else 'אין המלצה חדשה בעקבות בדיקה זו.' end,
   'recommendation_is_historical',p.outcome<>'confirmed' and p.completed_at>=o.completed_at,
   'is_attention_update',exists(select 1 from public.v2_guardian_case_attention_events e
      where e.incident_id=target_incident_id and e.assessment_seq=p.assessment_seq),
   'is_current',p.assessment_seq=target_through_seq,'is_first_confirmation',p.assessment_seq=c.first_confirmed_seq
 ) order by p.assessment_seq),'[]'::jsonb),
 case when (select count(*) from selected)>target_limit then max(p.assessment_seq) end,
 (select count(*) from selected)>target_limit
 from page p cross join original o;
end;
$$;

create function public.v2_set_guardian_case_state(target_incident_id uuid,target_state text,
 target_expected_assessment_seq bigint,target_expected_state_version bigint,target_request_key text)
returns table (incident_id uuid,assessment_seq bigint,attention_assessment_seq bigint,state text,state_version bigint,
 saved_at timestamptz,acknowledged_assessment_seq bigint,acknowledged_at timestamptz,updated_at timestamptz,replayed boolean)
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); c public.v2_three_gate_cases%rowtype;
 s public.v2_guardian_incident_states%rowtype; prior public.v2_guardian_case_state_requests%rowtype;
 key_hash bytea; payload_hash bytea; is_replay boolean:=false; action_at timestamptz;
begin
 if actor is null or not public.v2_guardian_can_read_confirmed_incident(target_incident_id) then
   raise exception 'guardian_incident_access_denied' using errcode='42501'; end if;
 if target_state is null or target_state not in ('new','saved','acknowledged')
   or target_expected_assessment_seq is null or target_expected_assessment_seq<1
   or target_expected_state_version is null or target_expected_state_version<0
   or target_request_key is null or target_request_key!~'^[A-Za-z0-9_:-]{16,200}$' then
   raise exception 'invalid_guardian_case_state' using errcode='22023'; end if;
 select * into c from public.v2_three_gate_cases x where x.parent_incident_id=target_incident_id for update;
 if c.parent_incident_id is null or not public.v2_guardian_has_active_child(c.child_id) then
   raise exception 'guardian_incident_access_denied' using errcode='42501'; end if;
 -- Serialize keys for this guardian across cases; all mutations lock case first.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,60908));
 key_hash:=extensions.digest(target_request_key,'sha256');
 payload_hash:=extensions.digest(jsonb_build_array(target_incident_id,target_state,
   target_expected_assessment_seq,target_expected_state_version)::text,'sha256');
 select * into prior from public.v2_guardian_case_state_requests r
   where r.guardian_user_id=actor and r.request_key_hash=key_hash;
 select * into s from public.v2_guardian_incident_states x
   where x.incident_id=target_incident_id and x.guardian_user_id=actor for update;
 if prior.guardian_user_id is not null then
   if prior.request_hash is distinct from payload_hash then
     raise exception 'guardian_case_request_conflict' using errcode='23505'; end if;
   is_replay:=true;
 else
   if target_expected_assessment_seq<>c.latest_applied_seq then
     raise exception 'guardian_assessment_version_conflict' using errcode='23505'; end if;
   if target_expected_state_version<>coalesce(s.state_version,0) then
     raise exception 'guardian_state_version_conflict' using errcode='23505'; end if;
   action_at:=clock_timestamp();
   insert into public.v2_guardian_incident_states as current
     (incident_id,guardian_user_id,state,state_version,saved_at,acknowledged_at,acknowledged_assessment_seq,last_acknowledged_at)
   values(target_incident_id,actor,target_state,1,
     case when target_state='saved' then action_at end,
     case when target_state='acknowledged' then action_at end,
     case when target_state='acknowledged' then c.latest_applied_seq end,
     case when target_state='acknowledged' then action_at end)
   on conflict on constraint v2_guardian_incident_states_pkey do update set
     state=excluded.state,state_version=current.state_version+1,
     saved_at=case when target_state='saved' then action_at when target_state='new' then null else current.saved_at end,
     acknowledged_at=case when target_state='acknowledged' then action_at end,
     acknowledged_assessment_seq=case when target_state='acknowledged' then c.latest_applied_seq else current.acknowledged_assessment_seq end,
     last_acknowledged_at=case when target_state='acknowledged' then action_at else current.last_acknowledged_at end
   returning * into s;
   insert into public.v2_guardian_case_state_requests
     (guardian_user_id,request_key_hash,incident_id,request_hash,applied_assessment_seq,applied_state_version)
   values(actor,key_hash,target_incident_id,payload_hash,c.latest_applied_seq,s.state_version);
   insert into public.v2_audit_events(actor_user_id,actor_type,action,object_type,object_id,outcome,metadata)
   values(actor,'guardian','v2.guardian.case_state.set','safety_incident',target_incident_id,'success',
     jsonb_build_object('state',target_state,'assessment_seq',c.latest_applied_seq,'state_version',s.state_version,'contract_version',2));
 end if;
 return query select target_incident_id,c.latest_applied_seq,c.attention_assessment_seq,
   coalesce(s.state,'new'),coalesce(s.state_version,0),s.saved_at,s.acknowledged_assessment_seq,
   coalesce(s.last_acknowledged_at,s.acknowledged_at),s.updated_at,is_replay;
end;
$$;

-- Keep legacy incident behavior, but old clients cannot acknowledge an unseen
-- case assessment. Patch only the known state RPC after its existing auth gate.
do $guard_legacy_case_state$
declare definition text; anchor text:=E'    insert into public.v2_guardian_incident_states (';
begin
 definition:=pg_get_functiondef('public.v2_set_guardian_incident_state(uuid,text,text)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
   raise exception 'unexpected_guardian_state_rpc_definition'; end if;
 execute replace(definition,anchor,
   E'    if exists(select 1 from public.v2_three_gate_cases c where c.parent_incident_id=target_incident_id) then\n'
   ||E'        raise exception ''guardian_assessment_version_required'' using errcode=''23505'';\n    end if;\n'
   ||anchor);
end;
$guard_legacy_case_state$;

revoke all on function public.v2_apply_guardian_case_completion() from public,anon,authenticated;
revoke all on function public.v2_get_guardian_case_summaries(uuid[]) from public,anon,authenticated;
revoke all on function public.v2_get_guardian_case_history(uuid,bigint,bigint,bigint,integer) from public,anon,authenticated;
revoke all on function public.v2_set_guardian_case_state(uuid,text,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.v2_get_guardian_case_summaries(uuid[]) to authenticated;
grant execute on function public.v2_get_guardian_case_history(uuid,bigint,bigint,bigint,integer) to authenticated;
grant execute on function public.v2_set_guardian_case_state(uuid,text,bigint,bigint,text) to authenticated;
comment on table public.v2_guardian_case_attention_events is 'Content-free immutable attention-event lineage; guardian reads only through authorized safe RPCs.';
comment on table public.v2_guardian_case_state_requests is 'Per-guardian request idempotency. Replays do not reapply past actions and return current state.';
commit;
