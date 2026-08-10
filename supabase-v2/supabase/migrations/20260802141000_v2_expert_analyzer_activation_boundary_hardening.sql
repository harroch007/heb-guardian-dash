begin;

-- The activation migration quarantined every unclaimed received incident.
-- Fail closed if an older analyzer lease exists, and cover the retry case
-- whose incident was already in the analyzing state.
do $$
begin
    if exists (
        select 1
        from public.v2_incident_analysis_jobs job
        join public.v2_safety_incidents incident
          on incident.id = job.incident_id
        where incident.status in ('received', 'analyzing')
          and job.state = 'leased'
          and not exists (
                select 1
                from public.v2_incident_analysis analysis
                where analysis.incident_id = job.incident_id
          )
    ) then
        raise exception 'pre_activation_analysis_lease_exists'
            using errcode = '55000';
    end if;
end
$$;

with quarantined_jobs as (
    update public.v2_incident_analysis_jobs job
       set state = 'quarantined'
      from public.v2_safety_incidents incident
     where incident.id = job.incident_id
       and incident.status = 'analyzing'
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
        'pre_activation_retry_excluded'
    )
from quarantined_jobs quarantined;

commit;
