begin;

-- Creation RPCs read child status before inserting their session. Recheck it
-- under a row lock so a creation which waited behind archival cannot leave a
-- usable installation link for an archived child. No session/token is exposed.
create function public.v2_guard_install_session_active_child()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    perform 1 from public.v2_children child
     where child.id = new.child_id and child.status = 'active'
     for key share of child;
    if not found then
        raise exception 'guardian_not_authorized' using errcode = '42501';
    end if;
    return new;
end;
$$;
revoke all on function public.v2_guard_install_session_active_child()
from public, anon, authenticated;

create trigger v2_child_install_active_child
before insert or update of child_id on public.v2_child_install_sessions
for each row execute function public.v2_guard_install_session_active_child();
create trigger v2_pairing_active_child
before insert or update of child_id on public.v2_pairing_sessions
for each row execute function public.v2_guard_install_session_active_child();

-- A begin/retry previously read active-device status without a lock, then
-- waited on its receipt. It could re-lease a receipt after archive cleared it.
-- Patch only that admission anchor in the current canonical definition.
-- Child must be locked before device: registration/archive use that order, and
-- incident INSERT later needs a child FK lock. Device-only SHARE first would
-- introduce an inverse-order deadlock. SHARE also conflicts with status UPDATE.
do $serialize_ephemeral_admission$
declare
    signature constant text :=
        'public.v2_begin_ephemeral_incident_analysis_service(uuid,uuid,text,text,text,real,real,timestamptz,smallint,smallint,bigint,integer,smallint,timestamptz,text,integer)';
    definition text;
    needle constant text := $anchor$    select device.child_id
      into resolved_child_id
      from public.v2_protected_devices device
     where device.id = target_device_id
       and device.status in ('active', 'degraded');$anchor$;
    replacement constant text := $anchor$    select child.id
      into resolved_child_id
      from public.v2_children child
     where child.id = (
        select device.child_id from public.v2_protected_devices device
         where device.id = target_device_id
           and device.status in ('active', 'degraded')
     ) and child.status = 'active'
     for key share of child;

    if resolved_child_id is not null then
        perform 1 from public.v2_protected_devices device
         where device.id = target_device_id
           and device.child_id = resolved_child_id
           and device.status in ('active', 'degraded')
         for share of device;
        if not found then resolved_child_id := null; end if;
    end if;$anchor$;
begin
    if to_regprocedure(signature) is null then
        raise exception 'archive_ephemeral_admission_missing';
    end if;
    definition := replace(pg_get_functiondef(to_regprocedure(signature)), E'\r\n', E'\n');
    if (length(definition) - length(replace(definition, needle, ''))) / length(needle) <> 1 then
        raise exception 'archive_ephemeral_admission_drift';
    end if;
    execute replace(definition, needle, replacement);
end;
$serialize_ephemeral_admission$;

create function public.v2_archive_guardian_child(
    target_child_id uuid,
    target_request_key text
)
returns table (child_id uuid, archived boolean)
language plpgsql security definer
set search_path = ''
set lock_timeout = '2s'
as $$
declare
    actor_id uuid := auth.uid();
    prior_status text;
begin
    -- Unknown child, another family and missing/revoked identity deliberately
    -- have the same public error. Check before taking any global session lock.
    if actor_id is null or not exists (
        select 1 from public.v2_children child
        join public.v2_families family on family.id = child.family_id
        join public.v2_guardian_memberships membership on membership.family_id = family.id
        where child.id = target_child_id and family.status = 'active'
          and membership.guardian_user_id = actor_id and membership.status = 'active'
    ) then
        raise exception 'guardian_not_authorized' using errcode = '42501';
    end if;
    perform public.v2_require_parental_request_key_service(target_request_key);

    -- Existing complete-install/complete-pairing lock session -> child -> device.
    -- Session table EXCLUSIVE locks (ordinary SELECT still allowed) serialize
    -- this rare removal with both session writers and SELECT FOR UPDATE before
    -- the child lock. A child-first cancellation would deadlock with completion.
    -- This intentionally blocks sessions across children for this transaction;
    -- lock_timeout bounds contention and the exception rolls back every change.
    lock table public.v2_child_install_sessions, public.v2_pairing_sessions
        in exclusive mode;

    -- Revalidate membership/family after waiting. Lock them through completion
    -- and serialize with v2_register_device_service's active-child FOR UPDATE.
    select child.status into prior_status
      from public.v2_children child
      join public.v2_families family on family.id = child.family_id
      join public.v2_guardian_memberships membership on membership.family_id = family.id
     where child.id = target_child_id and family.status = 'active'
       and membership.guardian_user_id = actor_id and membership.status = 'active'
     for update of child for share of family, membership;
    if not found then
        raise exception 'guardian_not_authorized' using errcode = '42501';
    end if;

    -- Archived is a successful durable result, even after a lost HTTP response
    -- or when another currently authorized guardian repeats the operation.
    if prior_status = 'archived' then
        return query select target_child_id, true;
        return;
    end if;

    update public.v2_children child set status = 'archived'
     where child.id = target_child_id;

    perform device.id from public.v2_protected_devices device
     where device.child_id = target_child_id order by device.id for update;
    update public.v2_device_credentials credential
       set revoked_at = coalesce(credential.revoked_at, now())
     where credential.revoked_at is null and credential.device_id in (
        select device.id from public.v2_protected_devices device
         where device.child_id = target_child_id
     );
    update public.v2_protected_devices device set status = 'revoked'
     where device.child_id = target_child_id and device.status <> 'revoked';

    update public.v2_child_install_sessions session set status = 'cancelled'
     where session.child_id = target_child_id and session.status in ('created', 'activated');
    -- The legacy table has no cancelled state. Its existing replacement RPC
    -- uses consumed_at to invalidate a code; preserve already consumed history.
    update public.v2_pairing_sessions session set consumed_at = now()
     where session.child_id = target_child_id and session.consumed_at is null;

    update public.v2_device_commands command
       set status = 'expired', failure_code = 'child_archived'
     where command.status in ('pending', 'claimed') and command.device_id in (
        select device.id from public.v2_protected_devices device
         where device.child_id = target_child_id
     );
    update public.v2_parental_time_requests request
       set status = 'expired', responded_at = now(), responded_by = actor_id
     where request.child_id = target_child_id and request.status = 'pending';
    update public.v2_p0_private_text_activation_grants grant_row set enabled = false
     where grant_row.child_id = target_child_id and grant_row.enabled;

    with prior as materialized (
        select state.* from public.v2_device_monitoring_state state
        join public.v2_protected_devices device on device.id = state.device_id
        where device.child_id = target_child_id and state.monitoring_state <> 'revoked'
        order by state.device_id for update of state
    ), changed as (
        update public.v2_device_monitoring_state state
           set monitoring_state = 'revoked', state_version = state.state_version + 1,
               reason_codes = array['child_archived'], late_after_at = null,
               interrupted_after_at = null, healthy_streak = 0
          from prior where state.device_id = prior.device_id
        returning state.device_id, prior.monitoring_state as previous_state,
                  state.state_version, state.episode_id
    )
    insert into public.v2_device_monitoring_transitions
        (device_id, episode_id, previous_state, new_state, reason_codes, source, state_version)
    select device_id, episode_id, previous_state, 'revoked', array['child_archived'], 'system', state_version
      from changed;

    -- Cancel legacy work/leases without changing a completed expert verdict.
    update public.v2_incident_analysis_jobs job
       set state = 'terminal_failed', terminal_at = now(),
           lease_owner = null, lease_token_hash = null, lease_expires_at = null,
           last_error_code = 'child_archived', last_error_class = 'configuration'
     where job.state in ('pending', 'retry', 'leased') and job.incident_id in (
        select incident.id from public.v2_safety_incidents incident
         where incident.child_id = target_child_id
     );
    -- V3 has no cancelled receipt state. Remove its lease; revoked devices
    -- cannot resume/finalize it. Do not fabricate completed/inconclusive output
    -- on the immutable three-gate assessment or overwrite historical results.
    update public.v2_ephemeral_incident_receipts receipt
       set state = 'received', lease_token_hash = null, lease_expires_at = null
     where receipt.state = 'leased' and receipt.incident_id in (
        select incident.id from public.v2_safety_incidents incident
         where incident.child_id = target_child_id
     );

    update public.v2_alert_deliveries delivery
       set status = 'suppressed', failure_code = 'child_archived', next_attempt_at = null,
           lease_owner = null, lease_token_hash = null, lease_expires_at = null
     where delivery.status in ('pending', 'failed') and delivery.incident_id in (
        select incident.id from public.v2_safety_incidents incident
         where incident.child_id = target_child_id
     );
    update public.v2_monitoring_alert_deliveries delivery
       set status = 'suppressed', failure_code = 'child_archived',
           suppressed_at = now(), suppression_reason = 'child_archived', next_attempt_at = null,
           lease_owner = null, lease_token_hash = null, lease_expires_at = null
     where delivery.status in ('queued', 'failed') and delivery.transition_id in (
        select transition.id from public.v2_device_monitoring_transitions transition
        join public.v2_protected_devices device on device.id = transition.device_id
        where device.child_id = target_child_id
     );

    insert into public.v2_audit_events
        (actor_user_id, actor_type, action, object_type, object_id, outcome, metadata)
    values (actor_id, 'guardian', 'v2.child.archive', 'child', target_child_id, 'success',
        jsonb_build_object('request_key_sha256',
            encode(extensions.digest(convert_to(target_request_key, 'UTF8'), 'sha256'), 'hex')));

    return query select target_child_id, true;
exception
    when lock_not_available or deadlock_detected then
        raise exception 'child_archive_busy' using errcode = '55P03';
end;
$$;

revoke all on function public.v2_archive_guardian_child(uuid, text)
from public, anon, authenticated;
grant execute on function public.v2_archive_guardian_child(uuid, text) to authenticated;

comment on function public.v2_archive_guardian_child(uuid, text) is
'Guardian-authorized irreversible child archival, with transactional device/session revocation and pending-work cancellation. Preserves history. Contention returns child_archive_busy (55P03). Already dispatched external work cannot be recalled.';

commit;
