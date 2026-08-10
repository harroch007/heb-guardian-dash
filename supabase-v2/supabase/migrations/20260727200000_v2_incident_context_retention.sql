begin;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.v2_delete_expired_incident_context_service(
    requested_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    deleted_count integer;
begin
    if requested_limit not between 1 and 5000 then
        raise exception 'invalid_retention_batch_limit'
            using errcode = '22023';
    end if;

    with expired as (
        select context.incident_id
          from public.v2_incident_context context
         where context.expires_at <= now()
         order by context.expires_at
         limit requested_limit
         for update skip locked
    )
    delete from public.v2_incident_context context
     using expired
     where context.incident_id = expired.incident_id;

    get diagnostics deleted_count = row_count;

    if deleted_count > 0 then
        insert into public.v2_audit_events (
            actor_type,
            action,
            object_type,
            outcome,
            metadata
        )
        values (
            'system',
            'v2.incident_context.retention',
            'incident_context',
            'success',
            jsonb_build_object('deleted_count', deleted_count)
        );
    end if;

    return deleted_count;
end;
$$;

revoke all
on function public.v2_delete_expired_incident_context_service(integer)
from public, anon, authenticated;

grant execute
on function public.v2_delete_expired_incident_context_service(integer)
to service_role;

do $$
declare
    existing_job_id bigint;
begin
    select job.jobid
      into existing_job_id
      from cron.job job
     where job.jobname = 'kippy-v2-expired-incident-context';

    if existing_job_id is not null then
        perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
        'kippy-v2-expired-incident-context',
        '*/15 * * * *',
        'select public.v2_delete_expired_incident_context_service(500);'
    );
end
$$;

commit;
