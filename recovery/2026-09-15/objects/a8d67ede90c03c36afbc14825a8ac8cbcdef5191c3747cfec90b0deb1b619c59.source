begin;

-- Guardian feedback is a review signal, never a training label or policy input.
create table public.v2_guardian_incident_feedback (
    incident_id uuid not null references public.v2_safety_incidents(id) on delete cascade,
    guardian_user_id uuid not null references auth.users(id) on delete cascade,
    usefulness text not null check (usefulness in ('helpful', 'not_helpful', 'unsure')),
    reason text check (reason in ('incorrect_interpretation', 'duplicate', 'already_handled', 'other')),
    model_provider text not null,
    model_name text not null,
    model_version text not null,
    prompt_version text not null,
    analysis_contract_version smallint not null,
    decision_outcome text not null,
    decision_reason_code text not null,
    decision_action_code text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default clock_timestamp(),
    primary key (incident_id, guardian_user_id),
    check ((usefulness = 'not_helpful' and reason is not null)
        or (usefulness <> 'not_helpful' and reason is null))
);
create table public.v2_guardian_missed_concerns (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null references public.v2_children(id) on delete cascade,
    guardian_user_id uuid not null references auth.users(id) on delete cascade,
    category text not null check (category in (
        'bullying', 'exclusion', 'sexual_content', 'violence', 'grooming',
        'manipulation', 'stranger_contact', 'self_harm', 'other')),
    occurred_on date not null,
    created_at timestamptz not null default now()
);
-- Responses contain only the typed rows above. Keys are hashed and never exposed.
create table public.v2_guardian_feedback_requests (
    guardian_user_id uuid not null references auth.users(id) on delete cascade,
    request_key_hash bytea not null,
    request_hash bytea not null,
    response jsonb not null,
    created_at timestamptz not null default now(),
    primary key (guardian_user_id, request_key_hash)
);

create or replace function public.v2_guardian_has_active_child(target_child_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
    select exists (
        select 1 from public.v2_children c
        join public.v2_families f on f.id = c.family_id and f.status = 'active'
        join public.v2_guardian_memberships m on m.family_id = f.id
        where c.id = target_child_id and c.status in ('active', 'paused')
          and m.guardian_user_id = auth.uid() and m.status = 'active'
    );
$$;

alter table public.v2_guardian_incident_feedback enable row level security;
alter table public.v2_guardian_incident_feedback force row level security;
alter table public.v2_guardian_missed_concerns enable row level security;
alter table public.v2_guardian_missed_concerns force row level security;
alter table public.v2_guardian_feedback_requests enable row level security;
alter table public.v2_guardian_feedback_requests force row level security;
create policy v2_read_own_incident_feedback on public.v2_guardian_incident_feedback
for select to authenticated using (
    guardian_user_id = auth.uid()
    and public.v2_guardian_can_read_confirmed_incident(incident_id)
    and exists (select 1 from public.v2_safety_incidents i
        where i.id = incident_id and public.v2_guardian_has_active_child(i.child_id))
);
create policy v2_read_own_missed_concerns on public.v2_guardian_missed_concerns
for select to authenticated using (
    guardian_user_id = auth.uid() and public.v2_guardian_has_active_child(child_id)
);
revoke all on public.v2_guardian_incident_feedback, public.v2_guardian_missed_concerns,
    public.v2_guardian_feedback_requests from public, anon, authenticated, service_role;
grant select on public.v2_guardian_incident_feedback, public.v2_guardian_missed_concerns to authenticated;

create or replace function public.v2_submit_guardian_incident_feedback(
    target_incident_id uuid, target_usefulness text, target_reason text, target_request_key text
) returns setof public.v2_guardian_incident_feedback
language plpgsql security definer set search_path = '' as $$
declare
    actor uuid := auth.uid();
    key_hash bytea;
    payload_hash bytea;
    prior public.v2_guardian_feedback_requests%rowtype;
    resolved public.v2_guardian_incident_feedback%rowtype;
begin
    if actor is null then raise exception 'guardian_authentication_required' using errcode = '42501'; end if;
    if target_incident_id is null or target_usefulness is null
       or target_usefulness not in ('helpful', 'not_helpful', 'unsure')
       or (target_usefulness = 'not_helpful' and (target_reason is null
            or target_reason not in ('incorrect_interpretation', 'duplicate', 'already_handled', 'other')))
       or (target_usefulness <> 'not_helpful' and target_reason is not null)
       or target_request_key is null or target_request_key !~ '^[A-Za-z0-9_:-]{16,200}$'
    then raise exception 'invalid_guardian_feedback' using errcode = '22023'; end if;
    if not public.v2_guardian_can_read_confirmed_incident(target_incident_id)
       or not exists (select 1 from public.v2_safety_incidents i where i.id = target_incident_id
            and public.v2_guardian_has_active_child(i.child_id))
    then raise exception 'guardian_incident_access_denied' using errcode = '42501'; end if;
    -- Serialize requests from one guardian, including cross-incident key reuse and limits.
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 60906));
    key_hash := extensions.digest(target_request_key, 'sha256');
    payload_hash := extensions.digest(jsonb_build_array('feedback', target_incident_id, target_usefulness, target_reason)::text, 'sha256');
    select * into prior from public.v2_guardian_feedback_requests r
        where r.guardian_user_id = actor and r.request_key_hash = key_hash;
    if found then
        if prior.request_hash <> payload_hash then raise exception 'feedback_idempotency_conflict' using errcode = '23505'; end if;
        return next jsonb_populate_record(null::public.v2_guardian_incident_feedback, prior.response); return;
    end if;
    if (select count(*) from public.v2_guardian_feedback_requests r
        where r.guardian_user_id = actor and r.created_at > now() - interval '1 day') >= 100
    then raise exception 'feedback_request_limit' using errcode = '54000'; end if;
    insert into public.v2_guardian_incident_feedback as f (
        incident_id, guardian_user_id, usefulness, reason, model_provider, model_name,
        model_version, prompt_version, analysis_contract_version,
        decision_outcome, decision_reason_code, decision_action_code
    ) select a.incident_id, actor, target_usefulness, target_reason, a.model_provider,
        a.model_name, a.model_version, a.prompt_version, a.analysis_contract_version,
        a.outcome, a.reason_code, a.action_code
      from public.v2_incident_analysis a where a.incident_id = target_incident_id and a.outcome = 'confirmed'
    on conflict (incident_id, guardian_user_id) do update set
        usefulness = excluded.usefulness, reason = excluded.reason,
        model_provider = excluded.model_provider, model_name = excluded.model_name,
        model_version = excluded.model_version, prompt_version = excluded.prompt_version,
        analysis_contract_version = excluded.analysis_contract_version,
        decision_outcome = excluded.decision_outcome, decision_reason_code = excluded.decision_reason_code,
        decision_action_code = excluded.decision_action_code, updated_at = clock_timestamp()
    returning * into strict resolved;
    insert into public.v2_guardian_feedback_requests values (actor, key_hash, payload_hash, to_jsonb(resolved), now());
    insert into public.v2_audit_events(actor_user_id, actor_type, action, object_type, object_id, outcome, metadata)
    values (actor, 'guardian', 'v2.guardian.feedback.submit', 'safety_incident', target_incident_id, 'success',
        jsonb_build_object('usefulness', target_usefulness, 'reason', target_reason, 'contract_version', 1));
    return next resolved; return;
end;
$$;

create or replace function public.v2_report_missed_safety_concern(
    target_child_id uuid, target_category text, target_occurred_on date, target_request_key text
) returns setof public.v2_guardian_missed_concerns
language plpgsql security definer set search_path = '' as $$
declare
    actor uuid := auth.uid();
    key_hash bytea;
    payload_hash bytea;
    prior public.v2_guardian_feedback_requests%rowtype;
    resolved public.v2_guardian_missed_concerns%rowtype;
begin
    if actor is null then raise exception 'guardian_authentication_required' using errcode = '42501'; end if;
    if target_child_id is null or target_category is null or target_category not in (
        'bullying', 'exclusion', 'sexual_content', 'violence', 'grooming', 'manipulation', 'stranger_contact', 'self_harm', 'other')
       or target_occurred_on is null or target_occurred_on not between (now() at time zone 'UTC')::date - 30 and (now() at time zone 'UTC')::date
       or target_request_key is null or target_request_key !~ '^[A-Za-z0-9_:-]{16,200}$'
    then raise exception 'invalid_missed_safety_concern' using errcode = '22023'; end if;
    if not public.v2_guardian_has_active_child(target_child_id)
    then raise exception 'guardian_child_access_denied' using errcode = '42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 60906));
    key_hash := extensions.digest(target_request_key, 'sha256');
    payload_hash := extensions.digest(jsonb_build_array('missed_concern', target_child_id, target_category, target_occurred_on)::text, 'sha256');
    select * into prior from public.v2_guardian_feedback_requests r
        where r.guardian_user_id = actor and r.request_key_hash = key_hash;
    if found then
        if prior.request_hash <> payload_hash then raise exception 'feedback_idempotency_conflict' using errcode = '23505'; end if;
        return next jsonb_populate_record(null::public.v2_guardian_missed_concerns, prior.response); return;
    end if;
    if (select count(*) from public.v2_guardian_missed_concerns c
        where c.guardian_user_id = actor and c.created_at > now() - interval '1 day') >= 30
       or (select count(*) from public.v2_guardian_feedback_requests r
        where r.guardian_user_id = actor and r.created_at > now() - interval '1 day') >= 100
    then raise exception 'feedback_request_limit' using errcode = '54000'; end if;
    insert into public.v2_guardian_missed_concerns(child_id, guardian_user_id, category, occurred_on)
    values (target_child_id, actor, target_category, target_occurred_on) returning * into resolved;
    insert into public.v2_guardian_feedback_requests values (actor, key_hash, payload_hash, to_jsonb(resolved), now());
    insert into public.v2_audit_events(actor_user_id, actor_type, action, object_type, object_id, outcome, metadata)
    values (actor, 'guardian', 'v2.guardian.missed_concern.report', 'missed_concern', resolved.id, 'success',
        jsonb_build_object('category', target_category, 'contract_version', 1));
    return next resolved; return;
end;
$$;

-- Only the database owner provisions this allowlist after verifying the human.
-- Neither browser roles nor the review service can appoint themselves.
create table public.v2_safety_feedback_reviewers (
    user_id uuid primary key references auth.users(id) on delete cascade,
    enabled boolean not null default false
);
create table public.v2_safety_feedback_reviews (
    id uuid primary key default gen_random_uuid(),
    feedback_kind text not null check (feedback_kind in ('incident', 'missed_concern')),
    target_id uuid not null,
    guardian_user_id uuid not null references auth.users(id) on delete cascade,
    feedback_updated_at timestamptz not null,
    reviewer_user_id uuid not null references auth.users(id),
    disposition text not null check (disposition in ('investigate', 'no_change', 'candidate_evaluation')),
    created_at timestamptz not null default now(),
    unique (feedback_kind, target_id, guardian_user_id, feedback_updated_at)
);
alter table public.v2_safety_feedback_reviewers enable row level security;
alter table public.v2_safety_feedback_reviewers force row level security;
alter table public.v2_safety_feedback_reviews enable row level security;
alter table public.v2_safety_feedback_reviews force row level security;
revoke all on public.v2_safety_feedback_reviewers, public.v2_safety_feedback_reviews from public, anon, authenticated, service_role;

create or replace view public.v2_safety_feedback_review_queue as
select 'incident'::text as feedback_kind, f.incident_id as target_id, f.guardian_user_id,
    f.updated_at as feedback_updated_at, i.category, f.usefulness, f.reason,
    f.model_name, f.model_version, f.prompt_version, f.decision_action_code,
    null::date as occurred_on
from public.v2_guardian_incident_feedback f
join public.v2_safety_incidents i on i.id = f.incident_id
where not exists (select 1 from public.v2_safety_feedback_reviews r where r.feedback_kind = 'incident'
    and r.target_id = f.incident_id and r.guardian_user_id = f.guardian_user_id and r.feedback_updated_at = f.updated_at)
union all
select 'missed_concern', c.id, c.guardian_user_id, c.created_at, c.category,
    null, null, null, null, null, null, c.occurred_on
from public.v2_guardian_missed_concerns c
where not exists (select 1 from public.v2_safety_feedback_reviews r where r.feedback_kind = 'missed_concern'
    and r.target_id = c.id and r.guardian_user_id = c.guardian_user_id and r.feedback_updated_at = c.created_at);

create or replace view public.v2_safety_feedback_aggregates as
select f.prompt_version, f.model_version, f.usefulness, f.reason,
    count(*)::bigint as response_count
from public.v2_guardian_incident_feedback f
group by f.prompt_version, f.model_version, f.usefulness, f.reason;
revoke all on public.v2_safety_feedback_review_queue, public.v2_safety_feedback_aggregates from public, anon, authenticated, service_role;
grant select on public.v2_safety_feedback_review_queue, public.v2_safety_feedback_aggregates to service_role;

create or replace function public.v2_review_safety_feedback_service(
    target_feedback_kind text, target_id uuid, target_guardian_user_id uuid,
    target_feedback_updated_at timestamptz, target_reviewer_user_id uuid, target_disposition text
) returns public.v2_safety_feedback_reviews
language plpgsql security definer set search_path = '' as $$
declare resolved public.v2_safety_feedback_reviews%rowtype;
begin
    if not exists (select 1 from public.v2_safety_feedback_reviewers r
        where r.user_id = target_reviewer_user_id and r.enabled)
    then raise exception 'authorized_human_reviewer_required' using errcode = '42501'; end if;
    if target_disposition is null or target_disposition not in ('investigate', 'no_change', 'candidate_evaluation')
    then raise exception 'invalid_review_disposition' using errcode = '22023'; end if;
    -- Lock the source revision so feedback updates cannot race this review.
    if target_feedback_kind = 'incident' then
        perform 1 from public.v2_guardian_incident_feedback f where f.incident_id = target_id
            and f.guardian_user_id = target_guardian_user_id and f.updated_at = target_feedback_updated_at for update;
    elsif target_feedback_kind = 'missed_concern' then
        perform 1 from public.v2_guardian_missed_concerns c where c.id = target_id
            and c.guardian_user_id = target_guardian_user_id and c.created_at = target_feedback_updated_at for update;
    else raise exception 'invalid_feedback_kind' using errcode = '22023';
    end if;
    if not found then raise exception 'feedback_revision_not_found' using errcode = '40001'; end if;
    select * into resolved from public.v2_safety_feedback_reviews r where r.feedback_kind = target_feedback_kind
        and r.target_id = v2_review_safety_feedback_service.target_id and r.guardian_user_id = target_guardian_user_id
        and r.feedback_updated_at = target_feedback_updated_at;
    if found then
        if resolved.reviewer_user_id <> target_reviewer_user_id or resolved.disposition <> target_disposition
        then raise exception 'feedback_review_conflict' using errcode = '23505'; end if;
        return resolved;
    end if;
    insert into public.v2_safety_feedback_reviews(feedback_kind, target_id, guardian_user_id,
        feedback_updated_at, reviewer_user_id, disposition)
    values (target_feedback_kind, target_id, target_guardian_user_id, target_feedback_updated_at,
        target_reviewer_user_id, target_disposition) returning * into resolved;
    insert into public.v2_audit_events(actor_user_id, actor_type, action, object_type, object_id, outcome, metadata)
    values (target_reviewer_user_id, 'service', 'v2.safety_feedback.human_review', 'feedback_review', resolved.id,
        'success', jsonb_build_object('disposition', target_disposition, 'contract_version', 1));
    return resolved;
end;
$$;

-- Typed, content-free usage ledger; NULL tokens mean unavailable, never zero cost.
create table public.v2_expert_provider_attempts (
    attempt_id uuid primary key,
    incident_id uuid not null references public.v2_safety_incidents(id) on delete cascade,
    endpoint text not null check (endpoint in ('ephemeral_v3', 'stored_queue')),
    attempt_number integer not null check (attempt_number > 0),
    provider text not null default 'openai' check (provider = 'openai'),
    model_name text not null check (model_name = 'gpt-5.6-luna'),
    prompt_version text not null check (prompt_version in ('kippy-expert-v4', 'kippy-expert-v5')),
    status text not null check (status in ('completed', 'inconclusive', 'transport_error', 'http_error', 'invalid_response')),
    http_status integer check (http_status between 100 and 599),
    latency_ms integer not null check (latency_ms between 0 and 600000),
    input_tokens integer check (input_tokens >= 0),
    cached_input_tokens integer check (cached_input_tokens >= 0),
    output_tokens integer check (output_tokens >= 0),
    reasoning_tokens integer check (reasoning_tokens >= 0),
    created_at timestamptz not null default now(),
    unique (incident_id, endpoint, attempt_number),
    check (cached_input_tokens is null or input_tokens is null or cached_input_tokens <= input_tokens),
    check (reasoning_tokens is null or output_tokens is null or reasoning_tokens <= output_tokens)
);
alter table public.v2_expert_provider_attempts enable row level security;
alter table public.v2_expert_provider_attempts force row level security;
revoke all on public.v2_expert_provider_attempts from public, anon, authenticated, service_role;
grant select on public.v2_expert_provider_attempts to service_role;

create or replace function public.v2_record_expert_provider_attempt_service(
    target_attempt_id uuid, target_incident_id uuid, target_lease_token text,
    target_endpoint text, target_status text, target_http_status integer,
    target_latency_ms integer, target_input_tokens integer, target_cached_input_tokens integer,
    target_output_tokens integer, target_reasoning_tokens integer
) returns void language plpgsql security definer set search_path = '' as $$
declare valid_lease boolean; next_attempt integer;
begin
    if target_attempt_id is null or target_incident_id is null or target_lease_token is null
       or target_lease_token !~ '^[a-f0-9]{64}$'
    then raise exception 'invalid_provider_attempt' using errcode = '22023'; end if;
    -- Expired leases may still report a failed/timed-out call; only ownership is checked.
    if target_endpoint = 'ephemeral_v3' then
        select exists (select 1 from public.v2_ephemeral_incident_receipts r where r.incident_id = target_incident_id
            and r.lease_token_hash = extensions.digest(target_lease_token, 'sha256')) into valid_lease;
    elsif target_endpoint = 'stored_queue' then
        select exists (select 1 from public.v2_incident_analysis_jobs j where j.incident_id = target_incident_id
            and j.lease_token_hash = extensions.digest(target_lease_token, 'sha256')) into valid_lease;
    else raise exception 'invalid_provider_endpoint' using errcode = '22023';
    end if;
    if not valid_lease then raise exception 'provider_attempt_lease_denied' using errcode = '42501'; end if;
    perform pg_advisory_xact_lock(hashtextextended(target_incident_id::text, 60907));
    if exists (select 1 from public.v2_expert_provider_attempts a where a.attempt_id = target_attempt_id) then
        if not exists (select 1 from public.v2_expert_provider_attempts a where a.attempt_id = target_attempt_id
            and a.incident_id = target_incident_id and a.endpoint = target_endpoint
            and a.status = target_status and a.http_status is not distinct from target_http_status
            and a.latency_ms = target_latency_ms and a.input_tokens is not distinct from target_input_tokens
            and a.cached_input_tokens is not distinct from target_cached_input_tokens
            and a.output_tokens is not distinct from target_output_tokens and a.reasoning_tokens is not distinct from target_reasoning_tokens)
        then raise exception 'provider_attempt_idempotency_conflict' using errcode = '23505'; end if;
        return;
    end if;
    select coalesce(max(a.attempt_number), 0) + 1 into next_attempt from public.v2_expert_provider_attempts a
        where a.incident_id = target_incident_id and a.endpoint = target_endpoint;
    insert into public.v2_expert_provider_attempts(attempt_id, incident_id, endpoint, attempt_number,
        model_name, prompt_version, status, http_status, latency_ms, input_tokens, cached_input_tokens,
        output_tokens, reasoning_tokens)
    values (target_attempt_id, target_incident_id, target_endpoint, next_attempt, 'gpt-5.6-luna',
        case target_endpoint when 'ephemeral_v3' then 'kippy-expert-v5' else 'kippy-expert-v4' end,
        target_status, target_http_status, target_latency_ms, target_input_tokens, target_cached_input_tokens,
        target_output_tokens, target_reasoning_tokens);
end;
$$;
create or replace view public.v2_expert_provider_usage_daily as
select (created_at at time zone 'UTC')::date as usage_date, endpoint, model_name, prompt_version, status,
    count(*)::bigint as attempts, count(*) filter (where attempt_number > 1)::bigint as retry_attempts,
    count(*) filter (where input_tokens is null or output_tokens is null)::bigint as usage_missing_attempts,
    sum(input_tokens)::bigint as input_tokens, sum(cached_input_tokens)::bigint as cached_input_tokens,
    sum(output_tokens)::bigint as output_tokens, sum(reasoning_tokens)::bigint as reasoning_tokens,
    avg(latency_ms)::numeric as average_latency_ms
from public.v2_expert_provider_attempts
group by (created_at at time zone 'UTC')::date, endpoint, model_name, prompt_version, status;
revoke all on public.v2_expert_provider_usage_daily from public, anon, authenticated, service_role;
grant select on public.v2_expert_provider_usage_daily to service_role;

revoke all on function public.v2_guardian_has_active_child(uuid),
    public.v2_submit_guardian_incident_feedback(uuid,text,text,text),
    public.v2_report_missed_safety_concern(uuid,text,date,text),
    public.v2_review_safety_feedback_service(text,uuid,uuid,timestamptz,uuid,text),
    public.v2_record_expert_provider_attempt_service(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer)
from public, anon, authenticated, service_role;
grant execute on function public.v2_guardian_has_active_child(uuid),
    public.v2_submit_guardian_incident_feedback(uuid,text,text,text),
    public.v2_report_missed_safety_concern(uuid,text,date,text) to authenticated;
grant execute on function public.v2_review_safety_feedback_service(text,uuid,uuid,timestamptz,uuid,text),
    public.v2_record_expert_provider_attempt_service(uuid,uuid,text,text,text,integer,integer,integer,integer,integer,integer)
to service_role;

comment on table public.v2_guardian_incident_feedback is 'Guardian opinion for restricted human review. No raw content, automatic training, threshold changes, incident relabeling or suppression.';
comment on table public.v2_expert_provider_attempts is 'Content-free observed provider usage. Missing usage is unknown. No assumed prices or spend caps. Telemetry failure must not suppress urgent analysis.';
commit;
