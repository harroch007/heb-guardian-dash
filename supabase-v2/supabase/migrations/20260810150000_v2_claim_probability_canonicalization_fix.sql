begin;

-- The first canonicalization wrapper formatted the already-truncated text
-- returned by the legacy REAL formatter. Join the claimed incident back to
-- its source row so all six Android AAD decimals are derived directly from
-- the stored float32 value.
create or replace function public.v2_claim_incident_analysis_service(
    target_capability_token text,
    target_worker_id uuid,
    target_lease_seconds integer
)
returns table (
    incident_id uuid,
    lease_token text,
    client_incident_id uuid,
    device_id uuid,
    child_id uuid,
    category text,
    severity text,
    child_role text,
    confidence_canonical text,
    capture_quality_canonical text,
    occurred_at_canonical text,
    model_contract_version smallint,
    privacy_contract_version smallint,
    privacy_identity_version bigint,
    aad_version smallint,
    encryption_algorithm text,
    key_version integer,
    message_count smallint,
    lease_expires_at_canonical text,
    context_expires_at_canonical text,
    encrypted_payload_base64 text
)
language sql
security definer
set search_path = ''
as $$
    select
        claim.incident_id,
        claim.lease_token,
        claim.client_incident_id,
        claim.device_id,
        claim.child_id,
        claim.category,
        claim.severity,
        claim.child_role,
        to_char(
            incident.confidence::double precision,
            'FM0.000000'
        ),
        to_char(
            incident.capture_quality::double precision,
            'FM0.000000'
        ),
        claim.occurred_at_canonical,
        claim.model_contract_version,
        claim.privacy_contract_version,
        claim.privacy_identity_version,
        claim.aad_version,
        claim.encryption_algorithm,
        claim.key_version,
        claim.message_count,
        claim.lease_expires_at_canonical,
        claim.context_expires_at_canonical,
        claim.encrypted_payload_base64
    from public.v2_claim_incident_analysis_uncanonicalized_internal(
        target_capability_token,
        target_worker_id,
        target_lease_seconds
    ) claim
    join public.v2_safety_incidents incident
      on incident.id = claim.incident_id;
$$;

comment on function public.v2_claim_incident_analysis_service(
    text,
    uuid,
    integer
) is
    'Claims one analysis job and derives Android-compatible six-decimal AAD probabilities directly from stored REAL values.';

revoke all on function
    public.v2_claim_incident_analysis_service(
        text,
        uuid,
        integer
    )
from public, anon, authenticated, service_role;

grant execute on function
    public.v2_claim_incident_analysis_service(
        text,
        uuid,
        integer
    )
to service_role;

commit;
