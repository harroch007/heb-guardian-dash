begin;

insert into auth.users (id)
values ('15200000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '15200000-0000-0000-0000-000000000001',
    true
);

select *
  from public.v2_bootstrap_guardian(
      '25200000-0000-4000-8000-000000000001',
      'OTP Recovery Guardian',
      null,
      'otp-recovery-bootstrap-0001'
  );

select *
  from public.v2_create_guardian_child(
      '35200000-0000-4000-8000-000000000001',
      '25200000-0000-4000-8000-000000000001',
      'OTP Recovery Child',
      2015::smallint,
      'female',
      'otp-recovery-child-0001'
  );

reset role;

insert into public.v2_child_install_sessions (
    id,
    child_id,
    created_by,
    activation_token_hash,
    expires_at
) values (
    '45200000-0000-4000-8000-000000000001',
    '35200000-0000-4000-8000-000000000001',
    '15200000-0000-0000-0000-000000000001',
    repeat('b', 64),
    now() + interval '15 minutes'
);

do $$
declare
    first_attempt record;
    recent_attempt record;
    retry_attempt record;
    stored_session public.v2_child_install_sessions%rowtype;
    released boolean;
begin
    select *
      into first_attempt
      from public.v2_activate_child_install_session_service(repeat('b', 64));

    if first_attempt.install_session_id is null
       or first_attempt.should_send_otp is distinct from true
       or first_attempt.otp_reservation_at is null then
        raise exception 'Initial OTP reservation was not created: %', first_attempt;
    end if;

    select *
      into stored_session
      from public.v2_child_install_sessions
     where id = '45200000-0000-4000-8000-000000000001';

    if stored_session.status <> 'activated'
       or stored_session.otp_request_count <> 1
       or stored_session.otp_requested_at is distinct from
          first_attempt.otp_reservation_at then
        raise exception 'Initial OTP reservation was not persisted safely';
    end if;

    select *
      into recent_attempt
      from public.v2_activate_child_install_session_service(repeat('b', 64));

    if recent_attempt.should_send_otp is distinct from false
       or recent_attempt.otp_reservation_at is distinct from
          first_attempt.otp_reservation_at then
        raise exception 'Recent OTP reservation was not reused safely: %', recent_attempt;
    end if;

    select public.v2_release_child_install_otp_reservation_service(
        first_attempt.install_session_id,
        first_attempt.otp_reservation_at + interval '1 microsecond'
    ) into released;

    if released then
        raise exception 'A mismatched OTP reservation was released';
    end if;

    select public.v2_release_child_install_otp_reservation_service(
        first_attempt.install_session_id,
        first_attempt.otp_reservation_at
    ) into released;

    if released is distinct from true then
        raise exception 'The failed OTP reservation was not released';
    end if;

    select *
      into stored_session
      from public.v2_child_install_sessions
     where id = first_attempt.install_session_id;

    if stored_session.status <> 'activated'
       or stored_session.otp_request_count <> 0
       or stored_session.otp_requested_at is not null then
        raise exception 'OTP release did not restore retryable session state';
    end if;

    select *
      into retry_attempt
      from public.v2_activate_child_install_session_service(repeat('b', 64));

    if retry_attempt.should_send_otp is distinct from true
       or retry_attempt.otp_reservation_at is null then
        raise exception 'The same activation link could not reserve a retry: %', retry_attempt;
    end if;

    update public.v2_child_install_sessions
       set status = 'consumed',
           consumed_at = now()
     where id = retry_attempt.install_session_id;

    select public.v2_release_child_install_otp_reservation_service(
        retry_attempt.install_session_id,
        retry_attempt.otp_reservation_at
    ) into released;

    if released then
        raise exception 'A consumed install released its OTP reservation';
    end if;

    if exists (
        select 1
          from public.v2_activate_child_install_session_service(repeat('b', 64))
    ) then
        raise exception 'A consumed activation link was accepted again';
    end if;
end
$$;

do $$
begin
    if has_function_privilege(
        'anon',
        'public.v2_release_child_install_otp_reservation_service(uuid,timestamptz)',
        'EXECUTE'
    ) or has_function_privilege(
        'authenticated',
        'public.v2_release_child_install_otp_reservation_service(uuid,timestamptz)',
        'EXECUTE'
    ) then
        raise exception 'A client role can release an OTP reservation';
    end if;

    if not has_function_privilege(
        'service_role',
        'public.v2_release_child_install_otp_reservation_service(uuid,timestamptz)',
        'EXECUTE'
    ) then
        raise exception 'Service role cannot release an OTP reservation';
    end if;
end
$$;

rollback;
