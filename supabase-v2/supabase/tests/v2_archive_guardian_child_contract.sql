\set ON_ERROR_STOP on
do $$ begin
    if current_database() <> 'kippy_child_management'
       or inet_server_addr() is distinct from '127.0.0.1'::inet
       or inet_server_port() is distinct from 57449 then
        raise exception 'archive_contract_requires_disposable_database';
    end if;
end $$;
-- Disposable, migrated PostgreSQL only. Synthetic fixtures, no external API,
-- no model/email/device calls. All fixtures and helper functions are rolled back.
-- A single connection does NOT prove concurrent scheduling. Root must also run
-- two-session races: (1) complete-install holds its session lock then finishes
-- before archive: archive revokes its new credential; (2) archive wins and a
-- waiting registration/session INSERT fails, leaving no live identity; (3) a
-- session ROW SHARE lock held >2s causes 55P03/child_archive_busy and zero changes.
begin;

create function pg_temp.archive_id(kind text, n integer default 1) returns uuid
language sql immutable as $$
    select (kind || '900000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.archive_assert(value boolean, label text) returns void
language plpgsql as $$
begin
    if value is distinct from true then raise exception 'archive_contract: %', label; end if;
end;
$$;
create function pg_temp.archive_error(statement text, expected_state text, expected_message text default null)
returns void language plpgsql as $$
begin
    begin
        execute statement;
    exception when others then
        if sqlstate = expected_state and (expected_message is null or sqlerrm = expected_message) then return; end if;
        raise exception 'archive_contract: unexpected SQLSTATE %, expected %', sqlstate, expected_state;
    end;
    raise exception 'archive_contract: expected rejection did not occur';
end;
$$;

insert into auth.users(id) select pg_temp.archive_id('1a', n) from generate_series(1,4) n;
insert into public.v2_families(id, display_name) values
    (pg_temp.archive_id('2a'), 'Synthetic archive family'),
    (pg_temp.archive_id('2a',2), 'Synthetic isolated family');
insert into public.v2_guardian_memberships(family_id, guardian_user_id, role, status) values
    (pg_temp.archive_id('2a'), pg_temp.archive_id('1a'), 'owner', 'active'),
    (pg_temp.archive_id('2a'), pg_temp.archive_id('1a',2), 'guardian', 'active'),
    (pg_temp.archive_id('2a',2), pg_temp.archive_id('1a',3), 'owner', 'active'),
    (pg_temp.archive_id('2a'), pg_temp.archive_id('1a',4), 'guardian', 'revoked');
insert into public.v2_children(id, family_id, display_name, status) values
    (pg_temp.archive_id('3a'), pg_temp.archive_id('2a'), 'Synthetic target', 'active'),
    (pg_temp.archive_id('3a',2), pg_temp.archive_id('2a',2), 'Synthetic other', 'active'),
    (pg_temp.archive_id('3a',3), pg_temp.archive_id('2a'), 'Synthetic paused', 'paused');
insert into public.v2_protected_devices(id, child_id, installation_id, app_version, status)
select pg_temp.archive_id('4a',n), pg_temp.archive_id('3a', case when n=4 then 2 else 1 end),
    pg_temp.archive_id('5a',n), 'synthetic-archive',
    case n when 2 then 'degraded' when 3 then 'revoked' else 'active' end
from generate_series(1,4) n;
-- Even a previously revoked device can have a leftover unrevoked credential.
insert into public.v2_device_credentials(device_id, credential_hash, key_version, expires_at)
select pg_temp.archive_id('4a',n), repeat(chr(96+n),64), 1, now()+interval '1 day'
from generate_series(1,4) n;
insert into public.v2_child_install_sessions
    (id, child_id, created_by, activation_token_hash, status, activated_at, expires_at)
values
    (pg_temp.archive_id('6a'), pg_temp.archive_id('3a'), pg_temp.archive_id('1a'),
     repeat('e',64), 'activated', now(), now()+interval '15 minutes'),
    (pg_temp.archive_id('6a',2), pg_temp.archive_id('3a',2), pg_temp.archive_id('1a',3),
     repeat('f',64), 'created', null, now()+interval '15 minutes');
insert into public.v2_pairing_sessions(id, child_id, created_by, code_hash, expires_at, consumed_at)
values
    (pg_temp.archive_id('7a'), pg_temp.archive_id('3a'), pg_temp.archive_id('1a'),
     repeat('a',64), now()+interval '10 minutes', null),
    (pg_temp.archive_id('7a',2), pg_temp.archive_id('3a'), pg_temp.archive_id('1a'),
     repeat('b',64), now()+interval '10 minutes', now()-interval '1 minute');
insert into public.v2_device_commands
    (id,device_id,command_type,payload,status,idempotency_key,expires_at)
select pg_temp.archive_id('8a',n), pg_temp.archive_id('4a',case when n=4 then 4 else 1 end),
    'REFRESH_SETTINGS','{}'::jsonb,
    case n when 2 then 'claimed' when 3 then 'completed' else 'pending' end,
    'synthetic-archive-command-'||n,now()+interval '1 hour'
from generate_series(1,4) n;
insert into public.v2_parental_time_requests(id,child_id,device_id,requested_minutes,expires_at)
values (pg_temp.archive_id('9a'),pg_temp.archive_id('3a'),pg_temp.archive_id('4a'),15,now()+interval '1 hour');
insert into public.v2_p0_private_text_activation_grants
    (device_id,child_id,enabled,valid_until,settings_revision)
values (pg_temp.archive_id('4a'),pg_temp.archive_id('3a'),true,now()+interval '1 day',1);

update public.v2_device_monitoring_state set monitoring_state='action_required',state_version=1
where device_id=pg_temp.archive_id('4a');
insert into public.v2_device_monitoring_transitions
    (id,device_id,previous_state,new_state,source,state_version)
values (pg_temp.archive_id('aa'),pg_temp.archive_id('4a'),'protected','action_required','system',1);
insert into public.v2_monitoring_alert_deliveries
    (id,transition_id,guardian_user_id,alert_type,severity,status,idempotency_key,expires_at,
     lease_owner,lease_token_hash,lease_expires_at)
values
    (pg_temp.archive_id('ba'),pg_temp.archive_id('aa'),pg_temp.archive_id('1a'),
     'monitoring_action_required','warning','queued','synthetic-archive-monitor-pending',now()+interval '1 hour',
     pg_temp.archive_id('1a'),decode(repeat('a',64),'hex'),now()+interval '1 minute'),
    (pg_temp.archive_id('ba',2),pg_temp.archive_id('aa'),pg_temp.archive_id('1a',2),
     'monitoring_action_required','warning','provider_accepted','synthetic-archive-monitor-sent',now()+interval '1 hour',
     null,null,null);

-- A pending legacy analysis and an actual completed SQL expert fixture exercise
-- cancellation versus history retention. Finalizer fixtures do not call a model.
insert into public.v2_safety_incidents
    (id,device_id,child_id,client_incident_id,category,severity,child_role,confidence,capture_quality,
     occurred_at,privacy_contract_version)
values (pg_temp.archive_id('ca'),pg_temp.archive_id('4a'),pg_temp.archive_id('3a'),pg_temp.archive_id('da'),
    'bullying','high','target',0.9,0.9,now(),2);
insert into public.v2_incident_context
    (incident_id,encrypted_payload,encryption_algorithm,key_version,message_count,expires_at,aad_version)
values (pg_temp.archive_id('ca'),decode('00','hex'),'RSA-OAEP-3072-SHA256+AES-256-GCM',1,1,now()+interval '1 hour',3);
update public.v2_incident_analysis_jobs set state='leased',lease_owner=pg_temp.archive_id('1a'),
    lease_token_hash=decode(repeat('a',64),'hex'),lease_expires_at=now()+interval '1 minute'
where incident_id=pg_temp.archive_id('ca');

create temp table archive_ephemeral_fixture(incident_id uuid,lease_token text,completed boolean);
do $$
declare b record; n integer;
begin
    for n in 1..2 loop
        select * into b from public.v2_begin_ephemeral_incident_analysis_service(
            pg_temp.archive_id('4a'),pg_temp.archive_id('ea',n),'bullying','high','target',
            0.9::real,0.9::real,now(),2::smallint,3::smallint,1::bigint,1,1::smallint,
            now()+interval '1 hour',repeat(chr(96+n),64),120);
        perform pg_temp.archive_assert(b.incident_id is not null and b.lease_token is not null,'ephemeral fixture lease');
        insert into archive_ephemeral_fixture values(b.incident_id,b.lease_token,n=2);
        if n=2 then
            perform public.v2_finalize_ephemeral_incident_analysis_service(
                b.incident_id,b.lease_token,'confirmed',
                public.v2_v3_reason_for_inference('confirmed','bullying'),
                public.v2_v3_action_for_inference('confirmed','bullying','high','elevated'),
                'gpt-5.6-luna','bullying',array[]::text[],'high','elevated','target','repeated',
                0.9::real,array[repeat('A',22)],
                public.v2_v3_channels_for_inference('confirmed','high','elevated'),'kippy-expert-v5');
        end if;
    end loop;
end;
$$;
create temp table archive_completed_history as
select receipt.incident_id,to_jsonb(receipt) as receipt, to_jsonb(analysis) as analysis
from archive_ephemeral_fixture fixture
join public.v2_ephemeral_incident_receipts receipt using(incident_id)
join public.v2_incident_analysis analysis using(incident_id) where fixture.completed;
select pg_temp.archive_assert(exists(select 1 from public.v2_alert_deliveries delivery
    join archive_ephemeral_fixture fixture using(incident_id) where fixture.completed and delivery.status='pending'),
    'pending confirmed delivery fixture exists');

-- Public ACL, safe namespace and bounded lock-wait contract.
select pg_temp.archive_assert(not has_function_privilege('anon','public.v2_archive_guardian_child(uuid,text)','EXECUTE'),
    'anonymous execute denied');
select pg_temp.archive_assert(has_function_privilege('authenticated','public.v2_archive_guardian_child(uuid,text)','EXECUTE'),
    'authenticated execute granted');
select pg_temp.archive_assert((select prosecdef and proconfig @> array['search_path=""','lock_timeout=2s']
    from pg_proc where oid='public.v2_archive_guardian_child(uuid,text)'::regprocedure),'definer configuration');

set local role anon;
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000001'',''archive-anonymous-0001'')',
    '42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000001'',''archive-no-identity-01'')',
    '42501','guardian_not_authorized');
select set_config('request.jwt.claim.sub',pg_temp.archive_id('1a')::text,true);
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000002'',''archive-cross-family-01'')',
    '42501','guardian_not_authorized');
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000099'',''archive-missing-child-01'')',
    '42501','guardian_not_authorized');
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(null,''archive-null-child-0001'')',
    '42501','guardian_not_authorized');
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000001'',''bad'')',
    '22023','invalid_request_key');
select set_config('request.jwt.claim.sub',pg_temp.archive_id('1a',4)::text,true);
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000001'',''archive-revoked-user-01'')',
    '42501','guardian_not_authorized');
reset role;
update public.v2_families set status='suspended' where id=pg_temp.archive_id('2a');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.archive_id('1a')::text,true);
select pg_temp.archive_error(
    'select * from public.v2_archive_guardian_child(''3a900000-0000-4000-8000-000000000001'',''archive-inactive-family'')',
    '42501','guardian_not_authorized');
reset role;
update public.v2_families set status='active' where id=pg_temp.archive_id('2a');
select pg_temp.archive_assert((select status='active' from public.v2_children where id=pg_temp.archive_id('3a')),
    'rejected calls had no child side effects');

set local role authenticated;
select pg_temp.archive_assert((select child_id=pg_temp.archive_id('3a') and archived
    from public.v2_archive_guardian_child(pg_temp.archive_id('3a'),'archive-success-0001')),'owner archive result');
select pg_temp.archive_assert((select archived from public.v2_archive_guardian_child(pg_temp.archive_id('3a'),
    'archive-success-0001')),'same request retry succeeds');
select set_config('request.jwt.claim.sub',pg_temp.archive_id('1a',2)::text,true);
select pg_temp.archive_assert((select archived from public.v2_archive_guardian_child(pg_temp.archive_id('3a'),
    'archive-another-guardian')),'authorized other guardian retry succeeds');
select pg_temp.archive_assert((select archived from public.v2_archive_guardian_child(pg_temp.archive_id('3a',3),
    'archive-paused-child-01')),'active guardian can archive paused child');
reset role;

select pg_temp.archive_assert((select status='archived' from public.v2_children where id=pg_temp.archive_id('3a')),
    'child archived, not deleted');
select pg_temp.archive_assert((select count(*)=3 and bool_and(status='revoked') from public.v2_protected_devices
    where child_id=pg_temp.archive_id('3a')),'all target devices retained and revoked');
select pg_temp.archive_assert((select count(*)=3 and bool_and(credential.revoked_at is not null)
    from public.v2_device_credentials credential join public.v2_protected_devices device on device.id=credential.device_id
    where device.child_id=pg_temp.archive_id('3a')),'all target credentials revoked');
select pg_temp.archive_assert((select status='cancelled' from public.v2_child_install_sessions where id=pg_temp.archive_id('6a')),
    'activated installation cancelled');
select pg_temp.archive_assert((select consumed_at is not null from public.v2_pairing_sessions where id=pg_temp.archive_id('7a')),
    'legacy pairing invalidated');
select pg_temp.archive_assert((select consumed_at=now()-interval '1 minute' from public.v2_pairing_sessions where id=pg_temp.archive_id('7a',2)),
    'consumed pairing history preserved');
select pg_temp.archive_assert((select count(*)=2 from public.v2_device_commands where id in (pg_temp.archive_id('8a'),pg_temp.archive_id('8a',2))
    and status='expired' and failure_code='child_archived'),'pending and claimed commands expired');
select pg_temp.archive_assert((select status='completed' from public.v2_device_commands where id=pg_temp.archive_id('8a',3)),
    'completed command preserved');
select pg_temp.archive_assert((select status='expired' and responded_at is not null from public.v2_parental_time_requests
    where id=pg_temp.archive_id('9a')),'pending time request expired');
select pg_temp.archive_assert((select not enabled from public.v2_p0_private_text_activation_grants where device_id=pg_temp.archive_id('4a')),
    'private text grant disabled');
select pg_temp.archive_assert((select monitoring_state='revoked' and state_version=2 and late_after_at is null
    and interrupted_after_at is null from public.v2_device_monitoring_state where device_id=pg_temp.archive_id('4a')),
    'monitoring revoked without false liveness');
select pg_temp.archive_assert((select count(*)=1 from public.v2_device_monitoring_transitions
    where device_id=pg_temp.archive_id('4a') and new_state='revoked' and source='system'),'single revocation transition');
select pg_temp.archive_assert((select status='suppressed' and suppression_reason='child_archived' and suppressed_at is not null
    and next_attempt_at is null and lease_owner is null and lease_token_hash is null and lease_expires_at is null
    from public.v2_monitoring_alert_deliveries where id=pg_temp.archive_id('ba')),'monitoring pending lease suppressed');
select pg_temp.archive_assert((select status='provider_accepted' from public.v2_monitoring_alert_deliveries where id=pg_temp.archive_id('ba',2)),
    'already dispatched monitoring preserved');
select pg_temp.archive_assert((select state='terminal_failed' and terminal_at is not null and lease_owner is null
    and lease_token_hash is null and lease_expires_at is null and last_error_code='child_archived'
    from public.v2_incident_analysis_jobs where incident_id=pg_temp.archive_id('ca')),'legacy job lease terminated');
select pg_temp.archive_assert((select receipt.state='received' and receipt.lease_token_hash is null and receipt.lease_expires_at is null
    from public.v2_ephemeral_incident_receipts receipt join archive_ephemeral_fixture fixture using(incident_id)
    where not fixture.completed),'ephemeral lease removed without fabricated verdict');
select pg_temp.archive_assert(not exists(select 1 from public.v2_alert_deliveries delivery
    join archive_ephemeral_fixture fixture using(incident_id)
    where fixture.completed and (delivery.status<>'suppressed' or delivery.next_attempt_at is not null or delivery.lease_owner is not null)),
    'pending incident deliveries suppressed');
select pg_temp.archive_assert((select to_jsonb(receipt)=history.receipt and to_jsonb(analysis)=history.analysis
    from archive_completed_history history join public.v2_ephemeral_incident_receipts receipt using(incident_id)
    join public.v2_incident_analysis analysis using(incident_id)),'completed expert history unchanged');
select pg_temp.archive_assert((select count(*)=1 from public.v2_audit_events
    where action='v2.child.archive' and object_id=pg_temp.archive_id('3a')),'idempotent audit');
select pg_temp.archive_assert((select status='active' from public.v2_children where id=pg_temp.archive_id('3a',2))
    and (select status='active' from public.v2_protected_devices where id=pg_temp.archive_id('4a',4))
    and (select revoked_at is null from public.v2_device_credentials where device_id=pg_temp.archive_id('4a',4))
    and (select status='created' from public.v2_child_install_sessions where id=pg_temp.archive_id('6a',2))
    and (select status='pending' from public.v2_device_commands where id=pg_temp.archive_id('8a',4)),
    'other family untouched');

-- Stale/replayed code cannot register or resurrect an archived child.
select pg_temp.archive_assert(not exists(select 1 from public.v2_activate_child_install_session_service(repeat('e',64))),
    'cancelled activation cannot issue OTP');
select pg_temp.archive_assert(not exists(select 1 from public.v2_complete_child_install_service(
    pg_temp.archive_id('1a'),pg_temp.archive_id('5a',9),'synthetic-retry',2::smallint,'test','test',repeat('9',64),now()+interval '1 day')),
    'cancelled installation cannot complete');
select pg_temp.archive_assert(not exists(select 1 from public.v2_complete_pairing_service(
    pg_temp.archive_id('7a'),repeat('a',64),pg_temp.archive_id('5a',9),'synthetic-retry',2::smallint,'test','test',repeat('9',64),now()+interval '1 day')),
    'cancelled legacy pairing cannot complete');
select pg_temp.archive_error($sql$select * from public.v2_register_device_service(
    pg_temp.archive_id('1a'),pg_temp.archive_id('3a'),pg_temp.archive_id('5a',9),'synthetic-retry',
    2::smallint,'test','test',repeat('9',64),now()+interval '1 day')$sql$,'42501','guardian_not_authorized');
select pg_temp.archive_error($sql$select * from public.v2_create_child_install_session_service(
    pg_temp.archive_id('1a'),pg_temp.archive_id('6a',9),pg_temp.archive_id('3a'),repeat('9',64),now()+interval '10 minutes')$sql$,
    '42501','guardian_not_authorized');
select pg_temp.archive_error($sql$insert into public.v2_child_install_sessions(id,child_id,created_by,activation_token_hash,expires_at)
    values(pg_temp.archive_id('6a',9),pg_temp.archive_id('3a'),pg_temp.archive_id('1a'),repeat('9',64),now()+interval '10 minutes')$sql$,
    '42501','guardian_not_authorized');
select pg_temp.archive_error($sql$insert into public.v2_pairing_sessions(id,child_id,created_by,code_hash,expires_at)
    values(pg_temp.archive_id('7a',9),pg_temp.archive_id('3a'),pg_temp.archive_id('1a'),repeat('9',64),now()+interval '10 minutes')$sql$,
    '42501','guardian_not_authorized');
select pg_temp.archive_error($sql$select * from public.v2_begin_ephemeral_incident_analysis_service(
    pg_temp.archive_id('4a'),pg_temp.archive_id('ea',9),'bullying','high','target',0.9::real,0.9::real,
    now(),2::smallint,3::smallint,1::bigint,1,1::smallint,now()+interval '1 hour',repeat('9',64),120)$sql$,
    '42501','device_not_active');

rollback;
