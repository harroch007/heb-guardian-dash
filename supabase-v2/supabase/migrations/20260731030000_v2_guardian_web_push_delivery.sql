begin;

-- Guardian Web Push is an authenticated V2 contract. Browser endpoints are
-- never accepted as arbitrary delivery URLs: only known standards-based push
-- service hosts are allowed, which prevents the worker from becoming an SSRF
-- proxy.
create or replace function public.v2_valid_web_push_endpoint(
    target_endpoint text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select
        target_endpoint is not null
        and char_length(target_endpoint) between 32 and 2048
        and target_endpoint !~ '[[:space:]@]'
        and (
            target_endpoint ~*
                '^https://fcm[.]googleapis[.]com/'
            or target_endpoint ~*
                '^https://updates[.]push[.]services[.]mozilla[.]com/'
            or target_endpoint ~*
                '^https://([A-Za-z0-9-]+[.])*push[.]apple[.]com/'
        );
$$;

alter table public.v2_guardian_push_endpoints
    add column invalidated_at timestamptz,
    add column last_success_at timestamptz,
    add column last_error_code text
        check (
            last_error_code is null
            or (
                char_length(last_error_code) between 1 and 80
                and last_error_code ~ '^[a-z0-9_]+$'
            )
        );

alter table public.v2_guardian_push_endpoints
    drop constraint if exists
        v2_guardian_push_endpoints_guardian_user_id_installation_id_key;

create unique index v2_guardian_push_endpoints_active_installation
    on public.v2_guardian_push_endpoints(
        guardian_user_id,
        installation_id
    )
    where status = 'active';

create index v2_guardian_push_endpoints_active_guardian
    on public.v2_guardian_push_endpoints(
        guardian_user_id,
        updated_at desc
    )
    where status = 'active'
      and permission_state = 'granted';

-- Existing staging rows that do not satisfy the strict provider boundary are
-- retained for auditability but can never be selected for delivery.
update public.v2_guardian_push_endpoints endpoint
   set status = 'invalid',
       invalidated_at = coalesce(endpoint.invalidated_at, now()),
       last_error_code = 'invalid_endpoint_host'
 where endpoint.status = 'active'
   and not public.v2_valid_web_push_endpoint(endpoint.endpoint);

drop policy if exists v2_guardians_manage_own_push_endpoints
on public.v2_guardian_push_endpoints;

revoke all on table public.v2_guardian_push_endpoints
from authenticated;

-- Registration binds the endpoint to auth.uid(), validates its encryption
-- material, and never trusts a guardian id supplied by the browser.
create or replace function public.v2_register_guardian_push_endpoint(
    target_installation_id uuid,
    target_endpoint text,
    target_p256dh text,
    target_auth_secret text,
    target_user_agent text,
    target_locale text
)
returns table (
    endpoint_id uuid,
    endpoint_status text,
    endpoint_last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    guardian_id uuid;
    normalized_endpoint text;
    resolved_hash text;
    existing_owner uuid;
    registered_endpoint public.v2_guardian_push_endpoints%rowtype;
begin
    guardian_id := auth.uid();
    normalized_endpoint := btrim(target_endpoint);

    if guardian_id is null then
        raise exception 'guardian_authentication_required'
            using errcode = '42501';
    end if;

    if target_installation_id is null
       or not public.v2_valid_web_push_endpoint(
            normalized_endpoint
       )
       or target_p256dh is null
       or char_length(target_p256dh) not between 80 and 120
       or target_p256dh !~ '^[A-Za-z0-9_-]+={0,2}$'
       or target_auth_secret is null
       or char_length(target_auth_secret) not between 16 and 64
       or target_auth_secret !~ '^[A-Za-z0-9_-]+={0,2}$'
       or target_user_agent is null
       or char_length(target_user_agent) not between 1 and 512
       or target_locale is null
       or char_length(target_locale) not between 2 and 35
       or target_locale !~ '^[A-Za-z0-9-]+$' then
        raise exception 'invalid_guardian_push_endpoint'
            using errcode = '22023';
    end if;

    resolved_hash := encode(
        extensions.digest(
            convert_to(normalized_endpoint, 'UTF8'),
            'sha256'
        ),
        'hex'
    );

    select endpoint.guardian_user_id
      into existing_owner
      from public.v2_guardian_push_endpoints endpoint
     where endpoint.endpoint_hash = resolved_hash
     for update;

    if existing_owner is not null
       and existing_owner <> guardian_id then
        raise exception 'push_endpoint_owned_by_another_guardian'
            using errcode = '23505';
    end if;

    update public.v2_guardian_push_endpoints endpoint
       set status = 'revoked',
           invalidated_at = now(),
           last_error_code = 'subscription_replaced'
     where endpoint.guardian_user_id = guardian_id
       and endpoint.installation_id = target_installation_id
       and endpoint.status = 'active'
       and endpoint.endpoint_hash <> resolved_hash;

    insert into public.v2_guardian_push_endpoints (
        guardian_user_id,
        installation_id,
        endpoint,
        endpoint_hash,
        p256dh,
        auth_secret,
        user_agent,
        locale,
        permission_state,
        status,
        last_seen_at,
        invalidated_at,
        last_error_code
    )
    values (
        guardian_id,
        target_installation_id,
        normalized_endpoint,
        resolved_hash,
        target_p256dh,
        target_auth_secret,
        target_user_agent,
        target_locale,
        'granted',
        'active',
        now(),
        null,
        null
    )
    on conflict (endpoint_hash) do update
       set installation_id = excluded.installation_id,
           endpoint = excluded.endpoint,
           p256dh = excluded.p256dh,
           auth_secret = excluded.auth_secret,
           user_agent = excluded.user_agent,
           locale = excluded.locale,
           permission_state = 'granted',
           status = 'active',
           last_seen_at = now(),
           invalidated_at = null,
           last_error_code = null
     where v2_guardian_push_endpoints.guardian_user_id =
            guardian_id
    returning *
      into registered_endpoint;

    if registered_endpoint.id is null then
        raise exception 'push_endpoint_owned_by_another_guardian'
            using errcode = '23505';
    end if;

    -- A guardian can reasonably use several browsers, but an unbounded number
    -- of active endpoints would amplify every alert. Keep the eight most
    -- recently verified installations and revoke older ones.
    with ranked as (
        select endpoint.id,
               row_number() over (
                   order by endpoint.last_seen_at desc, endpoint.id
               ) as endpoint_rank
          from public.v2_guardian_push_endpoints endpoint
         where endpoint.guardian_user_id = guardian_id
           and endpoint.status = 'active'
           and endpoint.permission_state = 'granted'
    )
    update public.v2_guardian_push_endpoints endpoint
       set status = 'revoked',
           invalidated_at = now(),
           last_error_code = 'active_endpoint_limit'
      from ranked
     where ranked.endpoint_rank > 8
       and endpoint.id = ranked.id;

    insert into public.v2_audit_events (
        actor_user_id,
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        guardian_id,
        'guardian',
        'v2.guardian.push_endpoint.register',
        'guardian_push_endpoint',
        registered_endpoint.id,
        'success',
        jsonb_build_object(
            'installation_id',
            target_installation_id,
            'contract_version',
            1
        )
    );

    return query
    select
        registered_endpoint.id,
        registered_endpoint.status,
        registered_endpoint.last_seen_at;
end;
$$;

create or replace function public.v2_revoke_guardian_push_endpoint(
    target_installation_id uuid,
    target_permission_state text default 'prompt'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    guardian_id uuid;
    changed_count integer;
begin
    guardian_id := auth.uid();
    if guardian_id is null then
        raise exception 'guardian_authentication_required'
            using errcode = '42501';
    end if;

    if target_installation_id is null
       or target_permission_state not in ('denied', 'prompt') then
        raise exception 'invalid_guardian_push_revocation'
            using errcode = '22023';
    end if;

    update public.v2_guardian_push_endpoints endpoint
       set status = 'revoked',
           permission_state = target_permission_state,
           invalidated_at = now(),
           last_error_code = 'guardian_revoked'
     where endpoint.guardian_user_id = guardian_id
       and endpoint.installation_id = target_installation_id
       and endpoint.status <> 'revoked';

    get diagnostics changed_count = row_count;

    if changed_count > 0 then
        insert into public.v2_audit_events (
            actor_user_id,
            actor_type,
            action,
            object_type,
            outcome,
            metadata
        )
        values (
            guardian_id,
            'guardian',
            'v2.guardian.push_endpoint.revoke',
            'guardian_push_endpoint',
            'success',
            jsonb_build_object(
                'installation_id',
                target_installation_id,
                'permission_state',
                target_permission_state
            )
        );
    end if;

    return changed_count > 0;
end;
$$;

create or replace function public.v2_get_guardian_push_state(
    target_installation_id uuid
)
returns table (
    is_subscribed boolean,
    endpoint_status text,
    permission_state text,
    last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        endpoint.id is not null
            and endpoint.status = 'active'
            and endpoint.permission_state = 'granted',
        endpoint.status,
        endpoint.permission_state,
        endpoint.last_seen_at
    from (select auth.uid() as guardian_id) identity
    left join lateral (
        select candidate.id,
               candidate.status,
               candidate.permission_state,
               candidate.last_seen_at
          from public.v2_guardian_push_endpoints candidate
         where candidate.guardian_user_id = identity.guardian_id
           and candidate.installation_id =
                target_installation_id
         order by
            (candidate.status = 'active') desc,
            candidate.updated_at desc
         limit 1
    ) endpoint on true
    where identity.guardian_id is not null
      and target_installation_id is not null;
$$;

revoke all on function
    public.v2_register_guardian_push_endpoint(
        uuid,
        text,
        text,
        text,
        text,
        text
    ),
    public.v2_revoke_guardian_push_endpoint(uuid, text),
    public.v2_get_guardian_push_state(uuid)
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_register_guardian_push_endpoint(
        uuid,
        text,
        text,
        text,
        text,
        text
    ),
    public.v2_revoke_guardian_push_endpoint(uuid, text),
    public.v2_get_guardian_push_state(uuid)
to authenticated;

-- Delivery rows are logical guardian/channel intents. Endpoint attempts are
-- tracked independently so retries never resend to a browser that already
-- accepted the notification.
alter table public.v2_alert_deliveries
    add column attempt_count integer not null default 0
        check (attempt_count between 0 and 20),
    add column next_attempt_at timestamptz default now(),
    add column lease_owner uuid,
    add column lease_token_hash bytea
        check (
            lease_token_hash is null
            or octet_length(lease_token_hash) = 32
        ),
    add column lease_expires_at timestamptz,
    add constraint v2_alert_deliveries_push_lease_shape
        check (
            (
                lease_owner is null
                and lease_token_hash is null
                and lease_expires_at is null
            )
            or (
                lease_owner is not null
                and lease_token_hash is not null
                and lease_expires_at is not null
            )
        );

create index v2_alert_deliveries_push_queue
    on public.v2_alert_deliveries(
        next_attempt_at,
        created_at
    )
    where channel = 'push'
      and status in ('pending', 'failed')
      and next_attempt_at is not null;

create table public.v2_push_delivery_endpoint_attempts (
    delivery_id uuid not null
        references public.v2_alert_deliveries(id) on delete cascade,
    endpoint_id uuid not null
        references public.v2_guardian_push_endpoints(id)
        on delete restrict,
    status text not null default 'queued'
        check (
            status in (
                'queued',
                'sent',
                'failed',
                'invalid'
            )
        ),
    attempt_count integer not null default 0
        check (attempt_count between 0 and 20),
    last_http_status smallint
        check (
            last_http_status is null
            or last_http_status between 100 and 599
        ),
    last_error_code text
        check (
            last_error_code is null
            or (
                char_length(last_error_code) between 1 and 80
                and last_error_code ~ '^[a-z0-9_]+$'
            )
        ),
    last_attempt_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (delivery_id, endpoint_id)
);

create trigger v2_push_delivery_attempts_set_updated_at
before update on public.v2_push_delivery_endpoint_attempts
for each row execute function public.v2_set_updated_at();

alter table public.v2_push_delivery_endpoint_attempts
    enable row level security;
alter table public.v2_push_delivery_endpoint_attempts
    force row level security;

revoke all on table public.v2_push_delivery_endpoint_attempts
from public, anon, authenticated;
grant all on table public.v2_push_delivery_endpoint_attempts
to service_role;

create table public.v2_push_worker_capabilities (
    token_hash bytea primary key
        check (octet_length(token_hash) = 32),
    label text not null
        check (char_length(label) between 1 and 120),
    status text not null default 'active'
        check (status in ('active', 'revoked')),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    check (
        (status = 'active' and revoked_at is null)
        or (status = 'revoked' and revoked_at is not null)
    )
);

alter table public.v2_push_worker_capabilities
    enable row level security;
alter table public.v2_push_worker_capabilities
    force row level security;

revoke all on table public.v2_push_worker_capabilities
from public, anon, authenticated;
grant all on table public.v2_push_worker_capabilities
to service_role;

create or replace function public.v2_push_worker_capability_is_valid(
    target_capability_token text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        target_capability_token is not null
        and char_length(target_capability_token) between 32 and 256
        and exists (
            select 1
              from public.v2_push_worker_capabilities capability
             where capability.token_hash = extensions.digest(
                    convert_to(
                        target_capability_token,
                        'UTF8'
                    ),
                    'sha256'
                )
               and capability.status = 'active'
               and capability.expires_at > now()
        );
$$;

create or replace function public.v2_claim_push_delivery_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_seconds integer default 120
)
returns table (
    delivery_id uuid,
    incident_id uuid,
    lease_token text,
    attempt_number integer,
    targets jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    claimed_delivery public.v2_alert_deliveries%rowtype;
    raw_lease_token text;
    resolved_targets jsonb;
begin
    if not public.v2_push_worker_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_push_worker_capability'
            using errcode = '42501';
    end if;

    if target_worker_id is null
       or target_lease_seconds is null
       or target_lease_seconds not between 30 and 300 then
        raise exception 'invalid_push_worker_claim'
            using errcode = '22023';
    end if;

    select delivery.*
      into claimed_delivery
      from public.v2_alert_deliveries delivery
     where delivery.channel = 'push'
       and delivery.status in ('pending', 'failed')
       and delivery.next_attempt_at is not null
       and delivery.next_attempt_at <= now()
       and (
            delivery.lease_owner is null
            or delivery.lease_expires_at <= now()
       )
     order by delivery.created_at, delivery.id
     for update skip locked
     limit 1;

    if not found then
        return;
    end if;

    raw_lease_token := encode(
        extensions.gen_random_bytes(32),
        'hex'
    );

    update public.v2_alert_deliveries delivery
       set status = 'pending',
           attempt_count = delivery.attempt_count + 1,
           attempted_at = now(),
           lease_owner = target_worker_id,
           lease_token_hash = extensions.digest(
                convert_to(raw_lease_token, 'UTF8'),
                'sha256'
           ),
           lease_expires_at =
                now() + make_interval(
                    secs => target_lease_seconds
                )
     where delivery.id = claimed_delivery.id
    returning *
      into claimed_delivery;

    insert into public.v2_push_delivery_endpoint_attempts (
        delivery_id,
        endpoint_id
    )
    select
        claimed_delivery.id,
        endpoint.id
      from public.v2_guardian_push_endpoints endpoint
     where endpoint.guardian_user_id =
            claimed_delivery.guardian_user_id
       and endpoint.status = 'active'
       and endpoint.permission_state = 'granted'
       and public.v2_valid_web_push_endpoint(endpoint.endpoint)
     order by endpoint.last_seen_at desc, endpoint.id
     limit 8
    on conflict on constraint
        v2_push_delivery_endpoint_attempts_pkey
    do nothing;

    update public.v2_push_delivery_endpoint_attempts attempt
       set status = 'invalid',
           last_error_code = 'endpoint_inactive',
           last_attempt_at = now()
      from public.v2_guardian_push_endpoints endpoint
     where attempt.delivery_id = claimed_delivery.id
       and endpoint.id = attempt.endpoint_id
       and attempt.status in ('queued', 'failed')
       and (
            endpoint.guardian_user_id <>
                claimed_delivery.guardian_user_id
            or endpoint.status <> 'active'
            or endpoint.permission_state <> 'granted'
            or not public.v2_valid_web_push_endpoint(
                endpoint.endpoint
            )
       );

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'endpoint_id',
                endpoint.id,
                'endpoint',
                endpoint.endpoint,
                'p256dh',
                endpoint.p256dh,
                'auth',
                endpoint.auth_secret
            )
            order by endpoint.id
        ),
        '[]'::jsonb
    )
      into resolved_targets
      from public.v2_push_delivery_endpoint_attempts attempt
      join public.v2_guardian_push_endpoints endpoint
        on endpoint.id = attempt.endpoint_id
     where attempt.delivery_id = claimed_delivery.id
       and attempt.status in ('queued', 'failed');

    return query
    select
        claimed_delivery.id,
        claimed_delivery.incident_id,
        raw_lease_token,
        claimed_delivery.attempt_count,
        resolved_targets;
end;
$$;

create or replace function public.v2_complete_push_delivery_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_token text,
    target_delivery_id uuid,
    target_results jsonb
)
returns table (
    delivery_status text,
    sent_target_count integer,
    invalid_target_count integer,
    retry_scheduled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    delivery public.v2_alert_deliveries%rowtype;
    result_item jsonb;
    result_endpoint_id uuid;
    result_outcome text;
    result_error_code text;
    result_http_status integer;
    seen_endpoint_ids uuid[] := array[]::uuid[];
    expected_result_count integer;
    failed_result_count integer := 0;
    total_sent_count integer := 0;
    total_invalid_count integer := 0;
    resolved_status text;
    resolved_failure_code text;
    resolved_next_attempt timestamptz;
    should_retry boolean := false;
begin
    if not public.v2_push_worker_capability_is_valid(
        target_capability_token
    ) then
        raise exception 'invalid_push_worker_capability'
            using errcode = '42501';
    end if;

    if target_worker_id is null
       or target_lease_token is null
       or char_length(target_lease_token) <> 64
       or target_delivery_id is null
       or target_results is null
       or jsonb_typeof(target_results) <> 'array'
       or jsonb_array_length(target_results) > 8 then
        raise exception 'invalid_push_delivery_results'
            using errcode = '22023';
    end if;

    select candidate.*
      into delivery
      from public.v2_alert_deliveries candidate
     where candidate.id = target_delivery_id
     for update;

    if not found
       or delivery.channel <> 'push'
       or delivery.status <> 'pending'
       or delivery.lease_owner is distinct from target_worker_id
       or delivery.lease_expires_at <= now()
       or delivery.lease_token_hash is distinct from
            extensions.digest(
                convert_to(target_lease_token, 'UTF8'),
                'sha256'
            ) then
        raise exception 'invalid_or_expired_push_lease'
            using errcode = '42501';
    end if;

    select count(*)::integer
      into expected_result_count
      from public.v2_push_delivery_endpoint_attempts attempt
     where attempt.delivery_id = delivery.id
       and attempt.status in ('queued', 'failed');

    if jsonb_array_length(target_results) <>
            expected_result_count then
        raise exception 'incomplete_push_delivery_results'
            using errcode = '22023';
    end if;

    for result_item in
        select item.value
          from jsonb_array_elements(target_results) item
    loop
        begin
            result_endpoint_id :=
                (result_item ->> 'endpoint_id')::uuid;
            result_outcome := result_item ->> 'outcome';
            result_error_code :=
                result_item ->> 'error_code';
            result_http_status := case
                when result_item ? 'http_status'
                 and jsonb_typeof(
                    result_item -> 'http_status'
                 ) = 'number'
                    then (result_item ->> 'http_status')::integer
                else null
            end;
        exception
            when others then
                raise exception 'invalid_push_delivery_results'
                    using errcode = '22023';
        end;

        if result_endpoint_id is null
           or result_endpoint_id = any(seen_endpoint_ids)
           or result_outcome not in (
                'sent',
                'invalid',
                'failed'
           )
           or (
                result_http_status is not null
                and result_http_status not between 100 and 599
           )
           or (
                result_outcome = 'sent'
                and result_error_code is not null
           )
           or (
                result_outcome <> 'sent'
                and (
                    result_error_code is null
                    or char_length(result_error_code)
                        not between 1 and 80
                    or result_error_code !~
                        '^[a-z0-9_]+$'
                )
           )
           or not exists (
                select 1
                  from public.v2_push_delivery_endpoint_attempts attempt
                 where attempt.delivery_id = delivery.id
                   and attempt.endpoint_id =
                        result_endpoint_id
                   and attempt.status in ('queued', 'failed')
           ) then
            raise exception 'invalid_push_delivery_results'
                using errcode = '22023';
        end if;

        seen_endpoint_ids :=
            array_append(
                seen_endpoint_ids,
                result_endpoint_id
            );

        update public.v2_push_delivery_endpoint_attempts attempt
           set status = result_outcome,
               attempt_count = attempt.attempt_count + 1,
               last_http_status = result_http_status,
               last_error_code = result_error_code,
               last_attempt_at = now(),
               sent_at = case
                    when result_outcome = 'sent'
                        then coalesce(attempt.sent_at, now())
                    else attempt.sent_at
               end
         where attempt.delivery_id = delivery.id
           and attempt.endpoint_id = result_endpoint_id;

        if result_outcome = 'sent' then
            update public.v2_guardian_push_endpoints endpoint
               set last_success_at = now(),
                   last_error_code = null
             where endpoint.id = result_endpoint_id;
        elsif result_outcome = 'invalid' then
            update public.v2_guardian_push_endpoints endpoint
               set status = 'invalid',
                   invalidated_at = now(),
                   last_error_code = result_error_code
             where endpoint.id = result_endpoint_id;
        else
            failed_result_count := failed_result_count + 1;
            update public.v2_guardian_push_endpoints endpoint
               set last_error_code = result_error_code
             where endpoint.id = result_endpoint_id;
        end if;
    end loop;

    select
        count(*) filter (
            where attempt.status = 'sent'
        )::integer,
        count(*) filter (
            where attempt.status = 'invalid'
        )::integer
      into total_sent_count, total_invalid_count
      from public.v2_push_delivery_endpoint_attempts attempt
     where attempt.delivery_id = delivery.id;

    if failed_result_count > 0
       and delivery.attempt_count < 5 then
        resolved_status := 'failed';
        resolved_failure_code := 'push_provider_transient';
        resolved_next_attempt := now() + case
            delivery.attempt_count
                when 1 then interval '15 seconds'
                when 2 then interval '1 minute'
                when 3 then interval '5 minutes'
                else interval '15 minutes'
        end;
        should_retry := true;
    elsif failed_result_count > 0 then
        resolved_status := case
            when total_sent_count > 0 then 'sent'
            else 'failed'
        end;
        resolved_failure_code := case
            when total_sent_count > 0
                then 'partial_delivery'
            else 'retry_exhausted'
        end;
        resolved_next_attempt := null;
    elsif total_sent_count > 0 then
        resolved_status := 'sent';
        resolved_failure_code := null;
        resolved_next_attempt := null;
    else
        resolved_status := 'suppressed';
        resolved_failure_code := case
            when total_invalid_count > 0
                then 'no_valid_endpoint'
            else 'no_active_endpoint'
        end;
        resolved_next_attempt := null;
    end if;

    update public.v2_alert_deliveries candidate
       set status = resolved_status,
           failure_code = resolved_failure_code,
           next_attempt_at = resolved_next_attempt,
           lease_owner = null,
           lease_token_hash = null,
           lease_expires_at = null
     where candidate.id = delivery.id;

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        'service',
        'v2.guardian.push_delivery.complete',
        'alert_delivery',
        delivery.id,
        case
            when resolved_status in ('sent', 'suppressed')
                then 'success'
            else 'failed'
        end,
        jsonb_build_object(
            'status',
            resolved_status,
            'attempt_number',
            delivery.attempt_count,
            'sent_target_count',
            total_sent_count,
            'invalid_target_count',
            total_invalid_count,
            'retry_scheduled',
            should_retry
        )
    );

    return query
    select
        resolved_status,
        total_sent_count,
        total_invalid_count,
        should_retry;
end;
$$;

revoke all on function
    public.v2_push_worker_capability_is_valid(text)
from public, anon, authenticated, service_role;

revoke all on function
    public.v2_claim_push_delivery_service(
        text,
        uuid,
        integer
    ),
    public.v2_complete_push_delivery_service(
        text,
        uuid,
        text,
        uuid,
        jsonb
    )
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_claim_push_delivery_service(
        text,
        uuid,
        integer
    ),
    public.v2_complete_push_delivery_service(
        text,
        uuid,
        text,
        uuid,
        jsonb
    )
to service_role;

-- The expert scheduler predates the repository-wide naming rule that
-- service-role RPCs end in _service while owner-only cron entry points end in
-- _internal. Aligning the name removes a false service-RPC ACL conflict
-- without changing analyzer behavior or activation state.
do $$
begin
    if to_regprocedure(
        'public.v2_dispatch_expert_analyzer_internal(integer)'
    ) is null then
        if to_regprocedure(
            'public.v2_dispatch_expert_analyzer_service(integer)'
        ) is null then
            raise exception 'missing_expert_scheduler_dispatcher';
        end if;
        execute
            'alter function public.v2_dispatch_expert_analyzer_service(integer) rename to v2_dispatch_expert_analyzer_internal';
    elsif to_regprocedure(
        'public.v2_dispatch_expert_analyzer_service(integer)'
    ) is not null then
        raise exception 'duplicate_expert_scheduler_dispatcher';
    end if;
end
$$;

revoke all on function
    public.v2_dispatch_expert_analyzer_internal(integer)
from public, anon, authenticated, service_role;

do $$
declare
    existing_job_id bigint;
begin
    select job.jobid
      into existing_job_id
      from cron.job job
     where job.jobname = 'kippy-v2-expert-analyzer';

    if existing_job_id is not null then
        perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
        'kippy-v2-expert-analyzer',
        '* * * * *',
        'select public.v2_dispatch_expert_analyzer_internal(4);'
    );
end
$$;

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- Owner-only dispatcher. Vault holds only the public HTTP trigger credential;
-- the database capability and VAPID private key never enter PostgreSQL.
create or replace function public.v2_dispatch_push_worker_internal(
    target_max_requests integer default 4
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    worker_endpoint text;
    worker_trigger_token text;
    dispatch_count integer;
    dispatch_index integer;
begin
    if target_max_requests is null
       or target_max_requests not between 1 and 8 then
        raise exception 'invalid_push_dispatch_batch'
            using errcode = '22023';
    end if;

    select secret.decrypted_secret
      into worker_endpoint
      from vault.decrypted_secrets secret
     where secret.name = 'kippy_v2_push_worker_endpoint'
     order by secret.created_at desc
     limit 1;

    select secret.decrypted_secret
      into worker_trigger_token
      from vault.decrypted_secrets secret
     where secret.name =
            'kippy_v2_push_worker_trigger_token'
     order by secret.created_at desc
     limit 1;

    if worker_endpoint is null
       or worker_endpoint !~
            '^https://[A-Za-z0-9.-]+/functions/v1/v2-deliver-parent-push$'
       or worker_trigger_token is null
       or char_length(worker_trigger_token)
            not between 32 and 256 then
        return 0;
    end if;

    select least(
        target_max_requests,
        count(*)
    )::integer
      into dispatch_count
      from public.v2_alert_deliveries delivery
     where delivery.channel = 'push'
       and delivery.status in ('pending', 'failed')
       and delivery.next_attempt_at is not null
       and delivery.next_attempt_at <= now()
       and (
            delivery.lease_owner is null
            or delivery.lease_expires_at <= now()
       );

    if dispatch_count = 0 then
        return 0;
    end if;

    for dispatch_index in 1..dispatch_count loop
        perform net.http_post(
            url := worker_endpoint,
            headers := jsonb_build_object(
                'Content-Type',
                'application/json',
                'x-kippy-push-token',
                worker_trigger_token
            ),
            body := jsonb_build_object(
                'source',
                'pg_cron',
                'dispatch_sequence',
                dispatch_index
            ),
            timeout_milliseconds := 25000
        );
    end loop;

    return dispatch_count;
end;
$$;

revoke all on function
    public.v2_dispatch_push_worker_internal(integer)
from public, anon, authenticated, service_role;

do $$
declare
    existing_job_id bigint;
begin
    select job.jobid
      into existing_job_id
      from cron.job job
     where job.jobname = 'kippy-v2-parent-push';

    if existing_job_id is not null then
        perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
        'kippy-v2-parent-push',
        '* * * * *',
        'select public.v2_dispatch_push_worker_internal(4);'
    );
end
$$;

comment on table public.v2_push_delivery_endpoint_attempts is
    'Per-browser Web Push attempts. A sent row means the push service accepted the encrypted payload; it is not proof the guardian opened it.';
comment on function public.v2_register_guardian_push_endpoint(
    uuid,
    text,
    text,
    text,
    text,
    text
) is
    'Authenticated guardian Web Push registration. Guardian identity is always auth.uid(); raw endpoint material is never returned.';
comment on function public.v2_dispatch_push_worker_internal(integer) is
    'Fail-closed owner-only dispatcher for due V2 parent push intents. Missing Vault activation values make it a no-op.';
comment on function
    public.v2_dispatch_expert_analyzer_internal(integer) is
    'Fail-closed owner-only pg_cron dispatcher for due expert-analysis jobs. Renamed from the obsolete _service suffix; behavior and activation gates are unchanged.';

commit;
