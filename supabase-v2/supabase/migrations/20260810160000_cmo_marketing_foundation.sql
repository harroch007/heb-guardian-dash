begin;

-- Kippy CMO foundation for the V2 staging control plane.
-- This migration creates no provider connector and performs no publication.

do $$
begin
    if to_regclass('public.v2_admin_principals') is null
       or to_regclass('public.v2_staff_permissions') is null
       or to_regclass('public.v2_staff_role_permissions') is null
       or to_regprocedure('public.v2_admin_current_staff_principal()') is null
       or to_regprocedure('public.v2_admin_has_permission(text,uuid)') is null
       or to_regprocedure('public.v2_admin_keep_append_only()') is null then
        raise exception 'v2_admin_foundation_required';
    end if;
end;
$$;

insert into public.v2_staff_permissions (
    permission_key,
    risk_class,
    description
)
values
    ('marketing.read', 'r1_internal', 'Read internal marketing control-tower records.'),
    ('marketing.manage', 'r1_internal', 'Create and revise marketing briefs and content.'),
    ('marketing.approve', 'r2', 'Approve marketing content after claims review.'),
    ('marketing.publish_intent', 'r2', 'Create a publication intent without publishing.'),
    ('marketing.audit.read', 'r0_sensitive', 'Read the append-only marketing audit trail.')
on conflict (permission_key) do update
set risk_class = excluded.risk_class,
    description = excluded.description;

insert into public.v2_staff_role_permissions (role_key, permission_key)
select role_key, permission_key
from (values
    ('ceo', 'marketing.read'),
    ('ceo', 'marketing.manage'),
    ('ceo', 'marketing.approve'),
    ('ceo', 'marketing.publish_intent'),
    ('ceo', 'marketing.audit.read'),
    ('growth_product_data', 'marketing.read'),
    ('growth_product_data', 'marketing.manage'),
    ('auditor', 'marketing.read'),
    ('auditor', 'marketing.audit.read')
) as requested(role_key, permission_key)
where exists (
    select 1
    from public.v2_staff_roles role
    where role.role_key = requested.role_key
)
on conflict (role_key, permission_key) do nothing;

create type public.v2_cmo_workflow_status as enum (
    'DRAFT',
    'POLICY_REVIEW',
    'AWAITING_APPROVAL',
    'APPROVED',
    'SCHEDULED',
    'PUBLISHED',
    'VERIFIED',
    'REJECTED',
    'FAILED',
    'CANCELLED'
);

create type public.v2_cmo_approval_status as enum (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
);

create table public.v2_marketing_waitlist_signups (
    id uuid primary key default gen_random_uuid(),
    parent_name text not null check (char_length(parent_name) between 2 and 120),
    email text not null check (
        char_length(email) between 3 and 320
        and email = lower(email)
        and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
    phone text not null check (phone ~ '^05[0-9]{8}$'),
    child_age smallint not null check (child_age between 4 and 18),
    device_os text not null check (device_os in ('android', 'iphone')),
    region text check (region is null or region in (
        'center', 'sharon', 'north', 'jerusalem', 'lowlands', 'south', 'abroad'
    )),
    referral_source text check (referral_source is null or referral_source in (
        'tv_press', 'websites', 'friends', 'search', 'other'
    )),
    referral_other text check (referral_other is null or char_length(referral_other) between 1 and 240),
    first_touch jsonb not null check (
        jsonb_typeof(first_touch) = 'object'
        and octet_length(first_touch::text) <= 4096
    ),
    submission_touch jsonb not null check (
        jsonb_typeof(submission_touch) = 'object'
        and octet_length(submission_touch::text) <= 4096
    ),
    landing_path text not null check (
        char_length(landing_path) between 1 and 300
        and landing_path like '/%'
        and landing_path !~ '[<>]'
    ),
    referrer_host text check (
        referrer_host is null
        or (
            char_length(referrer_host) between 1 and 255
            and referrer_host !~ '[/<>]'
        )
    ),
    marketing_notice_version text not null check (
        char_length(marketing_notice_version) between 1 and 80
        and marketing_notice_version !~ '[<>]'
    ),
    status text not null default 'PENDING' check (status in ('PENDING', 'CONTACTED', 'CANCELLED')),
    consented_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint v2_marketing_waitlist_referral_other_check check (
        (referral_source = 'other' and referral_other is not null)
        or (referral_source is distinct from 'other' and referral_other is null)
    )
);

create unique index v2_marketing_waitlist_email_unique
on public.v2_marketing_waitlist_signups (lower(email));

create table public.v2_cmo_campaign_briefs (
    id uuid primary key default gen_random_uuid(),
    objective text not null check (char_length(objective) between 1 and 1000),
    audience text not null check (char_length(audience) between 1 and 1000),
    launch_stage text not null check (launch_stage in ('PRELAUNCH', 'FREE', 'VOICE', 'PREMIUM')),
    channel text not null check (channel in ('FACEBOOK_PAGE', 'WEBSITE', 'FOUNDER', 'OTHER_ORGANIC')),
    hypothesis text not null check (char_length(hypothesis) between 1 and 1500),
    single_cta text not null check (char_length(single_cta) between 1 and 300),
    success_signals jsonb not null default '[]'::jsonb check (jsonb_typeof(success_signals) = 'array'),
    constraints_json jsonb not null default '[]'::jsonb check (jsonb_typeof(constraints_json) = 'array'),
    source_versions jsonb not null default '{}'::jsonb check (jsonb_typeof(source_versions) = 'object'),
    owner_principal_id uuid not null references public.v2_admin_principals(id),
    status public.v2_cmo_workflow_status not null default 'DRAFT',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_cmo_content_items (
    id uuid primary key default gen_random_uuid(),
    brief_id uuid not null references public.v2_cmo_campaign_briefs(id),
    format text not null check (char_length(format) between 1 and 80),
    copy_json jsonb not null check (jsonb_typeof(copy_json) = 'object' and octet_length(copy_json::text) <= 65536),
    creative_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(creative_refs) = 'array'),
    claim_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(claim_refs) = 'array'),
    utm jsonb not null default '{}'::jsonb check (jsonb_typeof(utm) = 'object'),
    claim_gate_result text not null default 'REVISE' check (claim_gate_result in ('PASS', 'REVISE', 'BLOCK')),
    claim_reviewed_at timestamptz,
    claim_reviewed_by uuid references public.v2_admin_principals(id),
    content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
    owner_principal_id uuid not null references public.v2_admin_principals(id),
    status public.v2_cmo_workflow_status not null default 'DRAFT',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_cmo_creative_assets (
    id uuid primary key default gen_random_uuid(),
    content_item_id uuid references public.v2_cmo_content_items(id),
    asset_type text not null check (char_length(asset_type) between 1 and 80),
    storage_ref text not null check (char_length(storage_ref) between 1 and 1000),
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
    claim_gate_result text not null default 'REVISE' check (claim_gate_result in ('PASS', 'REVISE', 'BLOCK')),
    content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
    owner_principal_id uuid not null references public.v2_admin_principals(id),
    status public.v2_cmo_workflow_status not null default 'DRAFT',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.v2_cmo_approval_requests (
    id uuid primary key default gen_random_uuid(),
    resource_type text not null check (resource_type in ('CAMPAIGN_BRIEF', 'CONTENT_ITEM', 'CREATIVE_ASSET', 'PUBLICATION_JOB')),
    resource_id uuid not null,
    content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
    preview jsonb not null default '{}'::jsonb check (jsonb_typeof(preview) = 'object'),
    risk text not null check (risk in ('LOW', 'MEDIUM', 'HIGH')),
    source_versions jsonb not null default '{}'::jsonb check (jsonb_typeof(source_versions) = 'object'),
    launch_stage text not null check (launch_stage in ('PRELAUNCH', 'FREE', 'VOICE', 'PREMIUM')),
    claim_review_result text not null check (claim_review_result in ('PASS', 'REVISE', 'BLOCK')),
    unresolved_risks jsonb not null default '[]'::jsonb check (jsonb_typeof(unresolved_risks) = 'array'),
    requested_by uuid not null references public.v2_admin_principals(id),
    requested_at timestamptz not null default now(),
    expires_at timestamptz not null,
    status public.v2_cmo_approval_status not null default 'PENDING',
    decided_by uuid references public.v2_admin_principals(id),
    decided_at timestamptz,
    decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (expires_at > requested_at),
    check (
        (status = 'PENDING' and decided_by is null and decided_at is null)
        or (status <> 'PENDING' and decided_at is not null)
    )
);

create unique index v2_cmo_one_pending_approval_per_resource
on public.v2_cmo_approval_requests (resource_type, resource_id)
where status = 'PENDING';

create table public.v2_cmo_publication_jobs (
    id uuid primary key default gen_random_uuid(),
    resource_type text not null check (resource_type in ('CONTENT_ITEM', 'CREATIVE_ASSET')),
    resource_id uuid not null,
    channel text not null check (channel in ('FACEBOOK_PAGE', 'WEBSITE', 'FOUNDER', 'OTHER_ORGANIC')),
    scheduled_for timestamptz,
    idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 200),
    approval_id uuid not null references public.v2_cmo_approval_requests(id),
    content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
    requested_by uuid not null references public.v2_admin_principals(id),
    status public.v2_cmo_workflow_status not null,
    provider_ref text,
    published_at timestamptz,
    verified_at timestamptz,
    verification_evidence jsonb,
    failure_code text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (status in ('APPROVED', 'SCHEDULED', 'PUBLISHED', 'VERIFIED', 'FAILED', 'CANCELLED')),
    check (provider_ref is null or char_length(provider_ref) <= 500),
    check (verification_evidence is null or jsonb_typeof(verification_evidence) = 'object')
);

create table public.v2_cmo_experiments (
    id uuid primary key default gen_random_uuid(),
    brief_id uuid not null references public.v2_cmo_campaign_briefs(id),
    name text not null check (char_length(name) between 1 and 200),
    hypothesis text not null check (char_length(hypothesis) between 1 and 1500),
    variants jsonb not null check (jsonb_typeof(variants) = 'array'),
    success_metric text not null check (char_length(success_metric) between 1 and 200),
    status text not null default 'DRAFT' check (status in ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETE', 'CANCELLED')),
    owner_principal_id uuid not null references public.v2_admin_principals(id),
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.v2_cmo_metric_snapshots (
    id bigint generated always as identity primary key,
    brief_id uuid not null references public.v2_cmo_campaign_briefs(id),
    period_start timestamptz not null,
    period_end timestamptz not null,
    source text not null check (char_length(source) between 1 and 120),
    dimensions jsonb not null default '{}'::jsonb check (jsonb_typeof(dimensions) = 'object'),
    metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
    collected_at timestamptz not null default now(),
    data_quality text not null check (data_quality in ('VALID', 'PARTIAL', 'STALE', 'INVALID')),
    collected_by uuid references public.v2_admin_principals(id),
    check (period_end > period_start)
);

create table public.v2_cmo_audit_events (
    id bigint generated always as identity primary key,
    actor_principal_id uuid references public.v2_admin_principals(id),
    actor_agent text,
    event_type text not null check (char_length(event_type) between 1 and 160),
    resource_type text not null check (char_length(resource_type) between 1 and 80),
    resource_id uuid,
    payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
    created_at timestamptz not null default now(),
    check (
        (actor_principal_id is not null and actor_agent is null)
        or (actor_principal_id is null and actor_agent is not null)
    )
);

create or replace function public.v2_cmo_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create or replace function public.v2_cmo_can_transition(
    from_status public.v2_cmo_workflow_status,
    to_status public.v2_cmo_workflow_status
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select from_status = to_status
        or (from_status::text || '>' || to_status::text) = any (array[
            'DRAFT>POLICY_REVIEW',
            'POLICY_REVIEW>AWAITING_APPROVAL',
            'POLICY_REVIEW>DRAFT',
            'AWAITING_APPROVAL>APPROVED',
            'AWAITING_APPROVAL>REJECTED',
            'AWAITING_APPROVAL>POLICY_REVIEW',
            'APPROVED>SCHEDULED',
            'APPROVED>POLICY_REVIEW',
            'APPROVED>CANCELLED',
            'SCHEDULED>PUBLISHED',
            'SCHEDULED>POLICY_REVIEW',
            'SCHEDULED>FAILED',
            'SCHEDULED>CANCELLED',
            'PUBLISHED>VERIFIED',
            'PUBLISHED>FAILED',
            'FAILED>SCHEDULED',
            'FAILED>CANCELLED',
            'REJECTED>DRAFT',
            'REJECTED>CANCELLED'
        ]);
$$;

create or replace function public.v2_marketing_touch_is_valid(target_touch jsonb)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select jsonb_typeof(target_touch) = 'object'
       and octet_length(target_touch::text) <= 4096
       and target_touch::text !~ '[<>]'
       and not exists (
           select 1
           from jsonb_each(target_touch) entry
           where entry.key not in (
               'utm_source', 'utm_medium', 'utm_campaign',
               'utm_content', 'utm_term', 'landing_path'
           )
              or jsonb_typeof(entry.value) not in ('string', 'null')
       )
       and coalesce(target_touch->>'landing_path', '') like '/%'
       and char_length(coalesce(target_touch->>'landing_path', '')) <= 300;
$$;

create or replace function public.v2_cmo_enforce_workflow_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if not public.v2_cmo_can_transition(old.status, new.status) then
        raise exception 'invalid_marketing_workflow_transition:%:%', old.status, new.status
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create or replace function public.v2_cmo_require_permission(target_permission_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    principal_id uuid;
begin
    principal_id := public.v2_admin_current_staff_principal();
    if not public.v2_admin_has_permission(target_permission_key, null) then
        raise exception 'marketing_permission_denied:%', target_permission_key
            using errcode = '42501';
    end if;
    return principal_id;
end;
$$;

create or replace function public.v2_cmo_write_audit_internal(
    target_actor_principal_id uuid,
    target_event_type text,
    target_resource_type text,
    target_resource_id uuid,
    target_payload jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
    insert into public.v2_cmo_audit_events (
        actor_principal_id,
        event_type,
        resource_type,
        resource_id,
        payload
    ) values (
        target_actor_principal_id,
        target_event_type,
        target_resource_type,
        target_resource_id,
        coalesce(target_payload, '{}'::jsonb)
    );
$$;

create or replace function public.v2_cmo_content_change_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (new.copy_json, new.creative_refs, new.claim_refs, new.utm, new.content_hash)
       is distinct from
       (old.copy_json, old.creative_refs, old.claim_refs, old.utm, old.content_hash) then
        if old.status in ('PUBLISHED', 'VERIFIED') then
            raise exception 'published_content_is_immutable' using errcode = '23514';
        end if;
        if new.content_hash = old.content_hash then
            raise exception 'content_hash_must_change_with_content' using errcode = '23514';
        end if;
        new.claim_gate_result := 'REVISE';
        new.claim_reviewed_at := null;
        new.claim_reviewed_by := null;
        if old.status in ('AWAITING_APPROVAL', 'APPROVED', 'SCHEDULED') then
            new.status := 'POLICY_REVIEW';
            update public.v2_cmo_approval_requests
               set status = 'CANCELLED',
                   decided_at = now(),
                   decision_note = 'Content changed after approval request.'
             where resource_type = 'CONTENT_ITEM'
               and resource_id = old.id
               and status in ('PENDING', 'APPROVED');
            update public.v2_cmo_publication_jobs
               set status = 'CANCELLED',
                   failure_code = 'CONTENT_CHANGED'
             where resource_type = 'CONTENT_ITEM'
               and resource_id = old.id
               and status in ('APPROVED', 'SCHEDULED', 'FAILED');
        end if;
    end if;
    return new;
end;
$$;

create or replace function public.v2_cmo_publication_integrity_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    approval_row public.v2_cmo_approval_requests%rowtype;
    current_hash text;
    current_gate text;
begin
    if tg_op = 'UPDATE' and new.status in ('FAILED', 'CANCELLED') then
        return new;
    end if;
    select * into approval_row
      from public.v2_cmo_approval_requests
     where id = new.approval_id;
    if not found
       or approval_row.status <> 'APPROVED'
       or approval_row.resource_type <> new.resource_type
       or approval_row.resource_id <> new.resource_id
       or approval_row.content_hash <> new.content_hash then
        raise exception 'approved_matching_approval_required' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' and approval_row.expires_at <= now() then
        raise exception 'approval_expired' using errcode = '23514';
    end if;
    if new.resource_type = 'CONTENT_ITEM' then
        select content_hash, claim_gate_result into current_hash, current_gate
          from public.v2_cmo_content_items where id = new.resource_id;
    elsif new.resource_type = 'CREATIVE_ASSET' then
        select content_hash, claim_gate_result into current_hash, current_gate
          from public.v2_cmo_creative_assets where id = new.resource_id;
    end if;
    if current_hash is null or current_hash <> new.content_hash or current_gate <> 'PASS' then
        raise exception 'publication_resource_not_claims_approved' using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger v2_marketing_waitlist_set_updated_at
before update on public.v2_marketing_waitlist_signups
for each row execute function public.v2_cmo_set_updated_at();

create trigger v2_cmo_campaign_briefs_set_updated_at
before update on public.v2_cmo_campaign_briefs
for each row execute function public.v2_cmo_set_updated_at();
create trigger v2_cmo_content_items_set_updated_at
before update on public.v2_cmo_content_items
for each row execute function public.v2_cmo_set_updated_at();
create trigger v2_cmo_creative_assets_set_updated_at
before update on public.v2_cmo_creative_assets
for each row execute function public.v2_cmo_set_updated_at();
create trigger v2_cmo_approval_requests_set_updated_at
before update on public.v2_cmo_approval_requests
for each row execute function public.v2_cmo_set_updated_at();
create trigger v2_cmo_publication_jobs_set_updated_at
before update on public.v2_cmo_publication_jobs
for each row execute function public.v2_cmo_set_updated_at();
create trigger v2_cmo_experiments_set_updated_at
before update on public.v2_cmo_experiments
for each row execute function public.v2_cmo_set_updated_at();

create trigger v2_cmo_campaign_briefs_transition
before update of status on public.v2_cmo_campaign_briefs
for each row execute function public.v2_cmo_enforce_workflow_transition();
create trigger v2_cmo_content_items_transition
before update of status on public.v2_cmo_content_items
for each row execute function public.v2_cmo_enforce_workflow_transition();
create trigger v2_cmo_creative_assets_transition
before update of status on public.v2_cmo_creative_assets
for each row execute function public.v2_cmo_enforce_workflow_transition();
create trigger v2_cmo_publication_jobs_transition
before update of status on public.v2_cmo_publication_jobs
for each row execute function public.v2_cmo_enforce_workflow_transition();

create trigger v2_cmo_content_change_guard
before update on public.v2_cmo_content_items
for each row execute function public.v2_cmo_content_change_guard();

create trigger v2_cmo_publication_integrity_guard
before insert or update on public.v2_cmo_publication_jobs
for each row execute function public.v2_cmo_publication_integrity_guard();

create trigger v2_cmo_audit_events_keep_append_only
before update or delete on public.v2_cmo_audit_events
for each row execute function public.v2_admin_keep_append_only();

create or replace function public.v2_submit_marketing_waitlist(
    target_parent_name text,
    target_email text,
    target_phone text,
    target_child_age smallint,
    target_device_os text,
    target_region text default null,
    target_referral_source text default null,
    target_referral_other text default null,
    target_first_touch jsonb default '{}'::jsonb,
    target_submission_touch jsonb default '{}'::jsonb,
    target_landing_path text default '/',
    target_referrer_host text default null,
    target_marketing_notice_version text default 'waitlist-updates-v1'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    signup_id uuid;
    normalized_name text := btrim(target_parent_name);
    normalized_email text := lower(btrim(target_email));
    normalized_phone text := regexp_replace(coalesce(target_phone, ''), '[-[:space:]]', '', 'g');
    normalized_referral_other text := nullif(btrim(target_referral_other), '');
begin
    if normalized_name ~ '[<>]'
       or normalized_email ~ '[<>]'
       or coalesce(target_referral_other, '') ~ '[<>]'
       or coalesce(target_landing_path, '') ~ '[<>]'
       or coalesce(target_referrer_host, '') ~ '[/<>]'
       or coalesce(target_marketing_notice_version, '') ~ '[<>]'
       or not public.v2_marketing_touch_is_valid(target_first_touch)
       or not public.v2_marketing_touch_is_valid(target_submission_touch) then
        raise exception 'invalid_waitlist_payload' using errcode = '22023';
    end if;

    insert into public.v2_marketing_waitlist_signups (
        parent_name, email, phone, child_age, device_os, region,
        referral_source, referral_other, first_touch, submission_touch,
        landing_path, referrer_host, marketing_notice_version
    ) values (
        normalized_name, normalized_email, normalized_phone, target_child_age,
        lower(btrim(target_device_os)), nullif(btrim(target_region), ''),
        nullif(btrim(target_referral_source), ''), normalized_referral_other,
        target_first_touch, target_submission_touch, target_landing_path,
        nullif(btrim(target_referrer_host), ''), target_marketing_notice_version
    ) returning id into signup_id;
    return signup_id;
exception
    when unique_violation then
        raise exception 'waitlist_signup_exists' using errcode = '23505';
end;
$$;

create or replace function public.v2_cmo_create_campaign_brief(
    target_objective text,
    target_audience text,
    target_launch_stage text,
    target_channel text,
    target_hypothesis text,
    target_single_cta text,
    target_success_signals jsonb default '[]'::jsonb,
    target_constraints jsonb default '[]'::jsonb,
    target_source_versions jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.manage');
    brief_id uuid;
begin
    insert into public.v2_cmo_campaign_briefs (
        objective, audience, launch_stage, channel, hypothesis, single_cta,
        success_signals, constraints_json, source_versions, owner_principal_id
    ) values (
        target_objective, target_audience, target_launch_stage, target_channel,
        target_hypothesis, target_single_cta, target_success_signals,
        target_constraints, target_source_versions, principal_id
    ) returning id into brief_id;
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'CAMPAIGN_BRIEF_CREATED', 'CAMPAIGN_BRIEF', brief_id,
        jsonb_build_object('launch_stage', target_launch_stage, 'channel', target_channel)
    );
    return brief_id;
end;
$$;

create or replace function public.v2_cmo_create_content_item(
    target_brief_id uuid,
    target_format text,
    target_copy jsonb,
    target_content_hash text,
    target_creative_refs jsonb default '[]'::jsonb,
    target_claim_refs jsonb default '[]'::jsonb,
    target_utm jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.manage');
    content_id uuid;
begin
    insert into public.v2_cmo_content_items (
        brief_id, format, copy_json, creative_refs, claim_refs, utm,
        content_hash, owner_principal_id
    ) values (
        target_brief_id, target_format, target_copy, target_creative_refs,
        target_claim_refs, target_utm, lower(target_content_hash), principal_id
    ) returning id into content_id;
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'CONTENT_ITEM_CREATED', 'CONTENT_ITEM', content_id,
        jsonb_build_object('brief_id', target_brief_id, 'content_hash', lower(target_content_hash))
    );
    return content_id;
end;
$$;

create or replace function public.v2_cmo_record_claim_review(
    target_content_id uuid,
    target_content_hash text,
    target_claim_gate_result text,
    target_claim_refs jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.manage');
    content_row public.v2_cmo_content_items%rowtype;
begin
    if target_claim_gate_result not in ('PASS', 'REVISE', 'BLOCK') then
        raise exception 'invalid_claim_gate_result' using errcode = '22023';
    end if;

    select * into content_row
      from public.v2_cmo_content_items
     where id = target_content_id
     for update;
    if not found
       or content_row.content_hash <> lower(target_content_hash)
       or content_row.status not in ('DRAFT', 'POLICY_REVIEW') then
        raise exception 'content_not_reviewable_or_hash_mismatch' using errcode = 'P0002';
    end if;
    if content_row.claim_refs is distinct from target_claim_refs then
        raise exception 'claim_refs_mismatch_for_content_hash' using errcode = '23514';
    end if;

    update public.v2_cmo_content_items
       set claim_gate_result = target_claim_gate_result,
           claim_reviewed_at = now(),
           claim_reviewed_by = principal_id,
           status = 'POLICY_REVIEW'
     where id = target_content_id;
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'CLAIM_REVIEW_RECORDED', 'CONTENT_ITEM', target_content_id,
        jsonb_build_object('result', target_claim_gate_result, 'content_hash', lower(target_content_hash))
    );
    return target_content_id;
end;
$$;

create or replace function public.v2_cmo_request_content_approval(
    target_content_id uuid,
    target_content_hash text,
    target_preview jsonb,
    target_risk text,
    target_source_versions jsonb,
    target_unresolved_risks jsonb default '[]'::jsonb,
    target_expires_at timestamptz default now() + interval '24 hours'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.manage');
    content_row public.v2_cmo_content_items%rowtype;
    launch_stage_value text;
    approval_id uuid;
begin
    select * into content_row from public.v2_cmo_content_items
     where id = target_content_id for update;
    if not found
       or content_row.status <> 'POLICY_REVIEW'
       or content_row.claim_gate_result <> 'PASS'
       or content_row.content_hash <> lower(target_content_hash)
       or content_row.claim_reviewed_at is null then
        raise exception 'content_not_ready_for_approval' using errcode = '23514';
    end if;
    if target_expires_at <= now() + interval '1 hour'
       or target_expires_at > now() + interval '7 days' then
        raise exception 'approval_expiry_out_of_range' using errcode = '22023';
    end if;
    select launch_stage into launch_stage_value
      from public.v2_cmo_campaign_briefs where id = content_row.brief_id;
    insert into public.v2_cmo_approval_requests (
        resource_type, resource_id, content_hash, preview, risk,
        source_versions, launch_stage, claim_review_result, unresolved_risks,
        requested_by, expires_at
    ) values (
        'CONTENT_ITEM', target_content_id, lower(target_content_hash), target_preview,
        target_risk, target_source_versions, launch_stage_value, 'PASS',
        target_unresolved_risks, principal_id, target_expires_at
    ) returning id into approval_id;
    update public.v2_cmo_content_items set status = 'AWAITING_APPROVAL'
     where id = target_content_id;
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'CONTENT_APPROVAL_REQUESTED', 'CONTENT_ITEM', target_content_id,
        jsonb_build_object('approval_id', approval_id, 'expires_at', target_expires_at)
    );
    return approval_id;
end;
$$;

create or replace function public.v2_cmo_decide_content_approval(
    target_approval_id uuid,
    target_decision text,
    target_content_hash text,
    target_decision_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.approve');
    approval_row public.v2_cmo_approval_requests%rowtype;
    resolved_status public.v2_cmo_approval_status;
begin
    if target_decision not in ('APPROVED', 'REJECTED') then
        raise exception 'invalid_approval_decision' using errcode = '22023';
    end if;
    select * into approval_row from public.v2_cmo_approval_requests
     where id = target_approval_id for update;
    if not found or approval_row.status <> 'PENDING' or approval_row.resource_type <> 'CONTENT_ITEM' then
        raise exception 'pending_content_approval_not_found' using errcode = 'P0002';
    end if;
    if approval_row.expires_at <= now() then
        resolved_status := 'EXPIRED';
    elsif approval_row.content_hash <> lower(target_content_hash)
       or not exists (
           select 1 from public.v2_cmo_content_items item
            where item.id = approval_row.resource_id
              and item.content_hash = approval_row.content_hash
              and item.claim_gate_result = 'PASS'
              and item.status = 'AWAITING_APPROVAL'
       ) then
        resolved_status := 'CANCELLED';
    else
        resolved_status := target_decision::public.v2_cmo_approval_status;
    end if;
    update public.v2_cmo_approval_requests
       set status = resolved_status,
           decided_by = principal_id,
           decided_at = now(),
           decision_note = target_decision_note
     where id = target_approval_id;
    update public.v2_cmo_content_items
       set status = case
           when resolved_status = 'APPROVED' then 'APPROVED'::public.v2_cmo_workflow_status
           when resolved_status = 'REJECTED' then 'REJECTED'::public.v2_cmo_workflow_status
           else 'POLICY_REVIEW'::public.v2_cmo_workflow_status
       end
     where id = approval_row.resource_id;
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'CONTENT_APPROVAL_DECIDED', 'CONTENT_ITEM', approval_row.resource_id,
        jsonb_build_object('approval_id', target_approval_id, 'status', resolved_status)
    );
    return target_approval_id;
end;
$$;

create or replace function public.v2_cmo_create_publication_intent(
    target_resource_type text,
    target_resource_id uuid,
    target_channel text,
    target_approval_id uuid,
    target_content_hash text,
    target_idempotency_key text,
    target_scheduled_for timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.publish_intent');
    job_id uuid;
    existing_job public.v2_cmo_publication_jobs%rowtype;
begin
    select * into existing_job from public.v2_cmo_publication_jobs
     where idempotency_key = target_idempotency_key;
    if found then
        if existing_job.resource_type <> target_resource_type
           or existing_job.resource_id <> target_resource_id
           or existing_job.channel <> target_channel
           or existing_job.approval_id <> target_approval_id
           or existing_job.content_hash <> lower(target_content_hash)
           or existing_job.scheduled_for is distinct from target_scheduled_for then
            raise exception 'publication_idempotency_conflict' using errcode = '23505';
        end if;
        return existing_job.id;
    end if;
    if target_scheduled_for is not null and target_scheduled_for <= now() then
        raise exception 'scheduled_time_must_be_future' using errcode = '22023';
    end if;
    insert into public.v2_cmo_publication_jobs (
        resource_type, resource_id, channel, scheduled_for, idempotency_key,
        approval_id, content_hash, requested_by, status
    ) values (
        target_resource_type, target_resource_id, target_channel, target_scheduled_for,
        target_idempotency_key, target_approval_id, lower(target_content_hash),
        principal_id,
        case when target_scheduled_for is not null
                  then 'SCHEDULED'::public.v2_cmo_workflow_status
             else 'APPROVED'::public.v2_cmo_workflow_status end
    ) returning id into job_id;
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'PUBLICATION_INTENT_CREATED', 'PUBLICATION_JOB', job_id,
        jsonb_build_object('resource_id', target_resource_id, 'channel', target_channel)
    );
    return job_id;
end;
$$;

create or replace function public.v2_cmo_list_pending_approvals(target_limit integer default 50)
returns table (
    approval_id uuid,
    resource_type text,
    resource_id uuid,
    content_hash text,
    preview jsonb,
    risk text,
    launch_stage text,
    unresolved_risks jsonb,
    requested_at timestamptz,
    expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.read');
begin
    perform public.v2_cmo_write_audit_internal(
        principal_id, 'PENDING_APPROVALS_LISTED', 'APPROVAL_REQUEST', null,
        jsonb_build_object('limit', least(greatest(coalesce(target_limit, 50), 1), 100))
    );
    return query
    select request.id, request.resource_type, request.resource_id,
           request.content_hash, request.preview, request.risk,
           request.launch_stage, request.unresolved_risks,
           request.requested_at, request.expires_at
      from public.v2_cmo_approval_requests request
     where request.status = 'PENDING'
       and request.expires_at > now()
     order by request.requested_at
     limit least(greatest(coalesce(target_limit, 50), 1), 100);
end;
$$;

alter table public.v2_marketing_waitlist_signups enable row level security;
alter table public.v2_cmo_campaign_briefs enable row level security;
alter table public.v2_cmo_content_items enable row level security;
alter table public.v2_cmo_creative_assets enable row level security;
alter table public.v2_cmo_approval_requests enable row level security;
alter table public.v2_cmo_publication_jobs enable row level security;
alter table public.v2_cmo_experiments enable row level security;
alter table public.v2_cmo_metric_snapshots enable row level security;
alter table public.v2_cmo_audit_events enable row level security;

revoke all on table public.v2_marketing_waitlist_signups from public, anon, authenticated;
revoke all on table public.v2_cmo_campaign_briefs from public, anon, authenticated;
revoke all on table public.v2_cmo_content_items from public, anon, authenticated;
revoke all on table public.v2_cmo_creative_assets from public, anon, authenticated;
revoke all on table public.v2_cmo_approval_requests from public, anon, authenticated;
revoke all on table public.v2_cmo_publication_jobs from public, anon, authenticated;
revoke all on table public.v2_cmo_experiments from public, anon, authenticated;
revoke all on table public.v2_cmo_metric_snapshots from public, anon, authenticated;
revoke all on table public.v2_cmo_audit_events from public, anon, authenticated;
revoke all on sequence public.v2_cmo_metric_snapshots_id_seq from public, anon, authenticated;
revoke all on sequence public.v2_cmo_audit_events_id_seq from public, anon, authenticated;

revoke all on function public.v2_cmo_set_updated_at() from public, anon, authenticated;
revoke all on function public.v2_cmo_can_transition(public.v2_cmo_workflow_status, public.v2_cmo_workflow_status) from public, anon, authenticated;
revoke all on function public.v2_marketing_touch_is_valid(jsonb) from public, anon, authenticated;
revoke all on function public.v2_cmo_enforce_workflow_transition() from public, anon, authenticated;
revoke all on function public.v2_cmo_require_permission(text) from public, anon, authenticated;
revoke all on function public.v2_cmo_write_audit_internal(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.v2_cmo_content_change_guard() from public, anon, authenticated;
revoke all on function public.v2_cmo_publication_integrity_guard() from public, anon, authenticated;

revoke all on function public.v2_submit_marketing_waitlist(text, text, text, smallint, text, text, text, text, jsonb, jsonb, text, text, text) from public;
grant execute on function public.v2_submit_marketing_waitlist(text, text, text, smallint, text, text, text, text, jsonb, jsonb, text, text, text) to anon, authenticated;

revoke all on function public.v2_cmo_create_campaign_brief(text, text, text, text, text, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.v2_cmo_create_content_item(uuid, text, jsonb, text, jsonb, jsonb, jsonb) from public;
revoke all on function public.v2_cmo_record_claim_review(uuid, text, text, jsonb) from public;
revoke all on function public.v2_cmo_request_content_approval(uuid, text, jsonb, text, jsonb, jsonb, timestamptz) from public;
revoke all on function public.v2_cmo_decide_content_approval(uuid, text, text, text) from public;
revoke all on function public.v2_cmo_create_publication_intent(text, uuid, text, uuid, text, text, timestamptz) from public;
revoke all on function public.v2_cmo_list_pending_approvals(integer) from public;

grant execute on function public.v2_cmo_create_campaign_brief(text, text, text, text, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.v2_cmo_create_content_item(uuid, text, jsonb, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.v2_cmo_record_claim_review(uuid, text, text, jsonb) to authenticated;
grant execute on function public.v2_cmo_request_content_approval(uuid, text, jsonb, text, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.v2_cmo_decide_content_approval(uuid, text, text, text) to authenticated;
grant execute on function public.v2_cmo_create_publication_intent(text, uuid, text, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.v2_cmo_list_pending_approvals(integer) to authenticated;

comment on table public.v2_marketing_waitlist_signups is
    'Pre-launch waitlist. Public clients may submit only through v2_submit_marketing_waitlist.';
comment on table public.v2_cmo_publication_jobs is
    'Reviewable publication intents only. This foundation contains no provider connector or spend path.';
comment on table public.v2_cmo_audit_events is
    'Append-only audit trail for staff marketing RPC actions.';
comment on function public.v2_submit_marketing_waitlist(text, text, text, smallint, text, text, text, text, jsonb, jsonb, text, text, text) is
    'Validated public waitlist submission boundary; returns the new signup UUID.';

commit;
