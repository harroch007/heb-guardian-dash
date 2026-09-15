begin;
alter table public.v2_moderation_batch_receipts
  add column last_error_code text check(last_error_code ~ '^[a-z][a-z0-9_]{0,79}$'),
  add column last_error_at timestamptz;
comment on column public.v2_moderation_batch_receipts.last_error_code is
  'Bounded application error or provider HTTP status code only. Never a provider body, error message, prompt or user content.';
create function public.v2_release_moderation_batch_service(
  target_device_id uuid,target_request_id uuid,target_lease_token text,target_error_code text
) returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if target_error_code is null or target_error_code !~ '^[a-z][a-z0-9_]{0,79}$' then
    raise exception 'invalid_moderation_error_code' using errcode='22023';
  end if;
  update public.v2_moderation_batch_receipts x set state='received',lease_token_hash=null,lease_expires_at=null,
    last_error_code=target_error_code,last_error_at=now()
  where x.device_id=target_device_id and x.request_id=target_request_id and x.state='leased'
    and x.lease_token_hash=extensions.digest(target_lease_token,'sha256');
  get diagnostics changed=row_count; return changed=1;
end; $$;
revoke all on function public.v2_release_moderation_batch_service(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.v2_release_moderation_batch_service(uuid,uuid,text,text) to service_role;
commit;
