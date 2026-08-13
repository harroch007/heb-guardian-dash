begin;

revoke all
on function public.v2_is_family_guardian(uuid)
from public, anon, service_role;

grant execute
on function public.v2_is_family_guardian(uuid)
to authenticated;

commit;
