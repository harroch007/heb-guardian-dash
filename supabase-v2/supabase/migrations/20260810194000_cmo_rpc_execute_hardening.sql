begin;

-- Supabase may grant API roles EXECUTE on newly created public functions.
-- CMO RPCs must be callable only by authenticated staff and must still pass
-- the V2 principal, AAL2, and permission checks enforced inside each RPC.
revoke execute on function public.v2_cmo_create_campaign_brief(text, text, text, text, text, text, jsonb, jsonb, jsonb)
    from public, anon, service_role;
revoke execute on function public.v2_cmo_create_content_item(uuid, text, jsonb, text, jsonb, jsonb, jsonb)
    from public, anon, service_role;
revoke execute on function public.v2_cmo_record_claim_review(uuid, text, text, jsonb)
    from public, anon, service_role;
revoke execute on function public.v2_cmo_request_content_approval(uuid, text, jsonb, text, jsonb, jsonb, timestamptz)
    from public, anon, service_role;
revoke execute on function public.v2_cmo_decide_content_approval(uuid, text, text, text)
    from public, anon, service_role;
revoke execute on function public.v2_cmo_create_publication_intent(text, uuid, text, uuid, text, text, timestamptz)
    from public, anon, service_role;
revoke execute on function public.v2_cmo_list_pending_approvals(integer)
    from public, anon, service_role;

grant execute on function public.v2_cmo_create_campaign_brief(text, text, text, text, text, text, jsonb, jsonb, jsonb)
    to authenticated;
grant execute on function public.v2_cmo_create_content_item(uuid, text, jsonb, text, jsonb, jsonb, jsonb)
    to authenticated;
grant execute on function public.v2_cmo_record_claim_review(uuid, text, text, jsonb)
    to authenticated;
grant execute on function public.v2_cmo_request_content_approval(uuid, text, jsonb, text, jsonb, jsonb, timestamptz)
    to authenticated;
grant execute on function public.v2_cmo_decide_content_approval(uuid, text, text, text)
    to authenticated;
grant execute on function public.v2_cmo_create_publication_intent(text, uuid, text, uuid, text, text, timestamptz)
    to authenticated;
grant execute on function public.v2_cmo_list_pending_approvals(integer)
    to authenticated;

-- This RPC writes an audit event before returning its result, so STABLE is
-- semantically incorrect even though the current runtime permits the call.
alter function public.v2_cmo_list_pending_approvals(integer) volatile;

commit;
