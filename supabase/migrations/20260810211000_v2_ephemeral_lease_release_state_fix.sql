begin;

-- Releasing an ephemeral lease makes the content-free receipt retryable.
-- The incident remains analyzing because analyzing -> received is forbidden by
-- the canonical incident state machine, while analyzing -> analyzing is safe
-- when the next lease is acquired.
create or replace function public.v2_release_ephemeral_incident_analysis_service(
    target_incident_id uuid,
    target_lease_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    released_count integer;
begin
    if target_lease_token is null or char_length(target_lease_token) <> 64 then
        return false;
    end if;

    update public.v2_ephemeral_incident_receipts receipt
       set state = 'received',
           lease_token_hash = null,
           lease_expires_at = null
     where receipt.incident_id = target_incident_id
       and receipt.state = 'leased'
       and receipt.lease_token_hash = extensions.digest(
           convert_to(target_lease_token, 'UTF8'),
           'sha256'
       );

    get diagnostics released_count = row_count;
    return released_count = 1;
end;
$$;

commit;
