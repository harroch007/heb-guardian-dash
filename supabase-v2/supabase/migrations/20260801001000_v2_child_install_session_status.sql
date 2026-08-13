begin;

create or replace function public.v2_get_child_install_session_status(
    target_session_id uuid
)
returns table (
    status text,
    expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        case
            when session.status in ('created', 'activated')
                 and session.expires_at <= now()
                then 'expired'
            else session.status
        end as status,
        session.expires_at
      from public.v2_child_install_sessions session
     where session.id = target_session_id
       and session.created_by = (select auth.uid())
       and public.v2_is_child_guardian(session.child_id);
$$;

revoke all on function public.v2_get_child_install_session_status(uuid)
from public, anon, authenticated;

grant execute on function public.v2_get_child_install_session_status(uuid)
to authenticated;

commit;
