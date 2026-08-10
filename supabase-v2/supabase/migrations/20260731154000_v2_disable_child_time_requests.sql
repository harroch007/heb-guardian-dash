begin;

-- Kippy V2 child installations are data/reporting and enforcement surfaces.
-- They do not initiate extra-time requests. Keep the already-created schema
-- for non-destructive staging compatibility, but close the active service
-- boundary so only direct guardian-granted bonus time remains.
revoke execute on function public.v2_create_parental_time_request_service(
    uuid,
    uuid,
    smallint,
    text,
    timestamptz
) from service_role;

comment on function public.v2_create_parental_time_request_service(
    uuid,
    uuid,
    smallint,
    text,
    timestamptz
) is
    'Dormant compatibility contract. Child-initiated time requests are disabled in Kippy V2.';

commit;
