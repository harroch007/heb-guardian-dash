begin;

revoke execute on function public.v2_is_child_guardian(uuid)
from anon;
revoke execute on function public.v2_is_device_guardian(uuid)
from anon;

grant execute on function public.v2_is_child_guardian(uuid)
to authenticated;
grant execute on function public.v2_is_device_guardian(uuid)
to authenticated;

commit;
