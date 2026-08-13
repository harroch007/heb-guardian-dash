begin;

drop function public.v2_activate_child_install_session_service(text);

create function public.v2_activate_child_install_session_service(
    supplied_activation_token_hash text
)
returns table (
    install_session_id uuid,
    guardian_user_id uuid,
    should_send_otp boolean,
    otp_reservation_at timestamptz,
    expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    session public.v2_child_install_sessions%rowtype;
    send_otp boolean;
    reserved_at timestamptz;
begin
    if char_length(supplied_activation_token_hash) <> 64 then
        return;
    end if;

    select *
      into session
      from public.v2_child_install_sessions install
     where install.activation_token_hash = supplied_activation_token_hash
     for update;

    if session.id is null
       or session.status not in ('created', 'activated') then
        return;
    end if;

    if session.expires_at <= now() then
        update public.v2_child_install_sessions
           set status = 'expired'
         where id = session.id;
        return;
    end if;

    send_otp :=
        session.otp_requested_at is null
        or session.otp_requested_at <= now() - interval '60 seconds';

    if send_otp and session.otp_request_count >= 3 then
        return;
    end if;

    reserved_at := case
        when send_otp then clock_timestamp()
        else session.otp_requested_at
    end;

    update public.v2_child_install_sessions
       set status = 'activated',
           activated_at = coalesce(activated_at, now()),
           otp_requested_at = reserved_at,
           otp_request_count = case
               when send_otp then otp_request_count + 1
               else otp_request_count
           end
     where id = session.id;

    return query
    select
        session.id,
        session.created_by,
        send_otp,
        reserved_at,
        session.expires_at;
end;
$$;

create function public.v2_release_child_install_otp_reservation_service(
    target_install_session_id uuid,
    expected_otp_reservation_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    released boolean;
begin
    if target_install_session_id is null
       or expected_otp_reservation_at is null then
        return false;
    end if;

    update public.v2_child_install_sessions
       set otp_requested_at = null,
           otp_request_count = greatest(otp_request_count - 1, 0)::smallint
     where id = target_install_session_id
       and status = 'activated'
       and consumed_at is null
       and otp_requested_at = expected_otp_reservation_at;

    released := found;
    return released;
end;
$$;

revoke all on function public.v2_activate_child_install_session_service(text)
from public, anon, authenticated;
revoke all on function public.v2_release_child_install_otp_reservation_service(
    uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.v2_activate_child_install_session_service(text)
to service_role;
grant execute on function public.v2_release_child_install_otp_reservation_service(
    uuid, timestamptz
) to service_role;

commit;
