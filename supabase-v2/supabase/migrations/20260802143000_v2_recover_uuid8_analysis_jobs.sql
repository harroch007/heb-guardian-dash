begin;

-- Recover only post-activation UUIDv6-v8 jobs that were terminalized by the
-- outdated crypto-header validator. The analyzer is kept disabled while this
-- migration runs; ciphertext and incident identity are not changed.
create temporary table v2_uuid8_analysis_recovery
on commit drop
as
select incident.id as incident_id
from public.v2_safety_incidents incident
join public.v2_incident_context context
  on context.incident_id = incident.id
join public.v2_incident_analysis_jobs job
  on job.incident_id = incident.id
where incident.status = 'analysis_failed'
  and incident.model_contract_version = 2
  and incident.privacy_contract_version = 1
  and substring(
        incident.client_incident_id::text
        from 15 for 1
      ) in ('6', '7', '8')
  and context.aad_version = 3
  and context.expires_at > now() + interval '3 minutes'
  and job.state = 'terminal_failed'
  and job.last_error_code = 'invalid_claim_header'
  and job.last_error_class = 'analysis'
  and not exists (
        select 1
        from public.v2_incident_analysis analysis
        where analysis.incident_id = incident.id
  )
  and not exists (
        select 1
        from public.v2_audit_events audit
        where audit.object_id = incident.id
          and audit.action =
            'v2.incident.analysis.pre_activation_quarantine'
  );

alter table public.v2_safety_incidents
    disable trigger v2_safety_incidents_guard_update;

update public.v2_safety_incidents incident
   set status = 'received'
 where incident.id in (
        select recovery.incident_id
        from v2_uuid8_analysis_recovery recovery
 );

alter table public.v2_safety_incidents
    enable trigger v2_safety_incidents_guard_update;

update public.v2_incident_analysis_jobs job
   set state = 'retry',
       attempt_count = 0,
       outage_count = 0,
       next_attempt_at = now(),
       lease_owner = null,
       lease_token_hash = null,
       lease_expires_at = null,
       last_error_code = null,
       last_error_class = null,
       terminal_at = null
 where job.incident_id in (
        select recovery.incident_id
        from v2_uuid8_analysis_recovery recovery
 );

insert into public.v2_audit_events (
    actor_type,
    action,
    object_type,
    object_id,
    outcome,
    metadata
)
select
    'system',
    'v2.incident.analysis.uuid8_contract_recovery',
    'safety_incident',
    recovery.incident_id,
    'success',
    jsonb_build_object(
        'state',
        'retry',
        'recovered_error_code',
        'invalid_claim_header'
    )
from v2_uuid8_analysis_recovery recovery;

commit;
