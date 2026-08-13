begin;

-- Incidents captured before expert-analysis activation stay available for
-- retention/audit, but they must never be sent to the external expert.
-- New jobs keep the existing pending default and are processed normally.
alter table public.v2_incident_analysis_jobs
    drop constraint v2_incident_analysis_jobs_state_check;

alter table public.v2_incident_analysis_jobs
    add constraint v2_incident_analysis_jobs_state_check
        check (
            state in (
                'pending',
                'leased',
                'retry',
                'completed',
                'terminal_failed',
                'quarantined'
            )
        );

with activation_boundary as (
    select statement_timestamp() as activated_at
), quarantined_jobs as (
    update public.v2_incident_analysis_jobs job
       set state = 'quarantined',
           last_error_code = null,
           last_error_class = null
      from public.v2_safety_incidents incident,
           activation_boundary boundary
     where incident.id = job.incident_id
       and incident.received_at < boundary.activated_at
       and incident.status = 'received'
       and job.state in ('pending', 'retry')
       and not exists (
            select 1
            from public.v2_incident_analysis analysis
            where analysis.incident_id = job.incident_id
       )
    returning job.incident_id
)
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
    'v2.incident.analysis.pre_activation_quarantine',
    'safety_incident',
    quarantined.incident_id,
    'success',
    jsonb_build_object(
        'state',
        'quarantined',
        'reason',
        'pre_activation_backlog_excluded'
    )
from quarantined_jobs quarantined;

comment on constraint
    v2_incident_analysis_jobs_state_check
    on public.v2_incident_analysis_jobs is
    'Quarantined jobs are retained for audit/expiry but are never claimable or dispatched to the external expert.';

commit;
