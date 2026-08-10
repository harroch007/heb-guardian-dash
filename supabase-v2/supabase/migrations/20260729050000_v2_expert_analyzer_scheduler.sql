begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- The cron worker never receives the database capability or the OpenAI key.
-- It holds only the same public trigger credential checked by the Edge
-- function. Missing Vault entries make this function a no-op.
create or replace function
public.v2_dispatch_expert_analyzer_service(
    target_max_requests integer default 4
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    analyzer_endpoint text;
    analyzer_trigger_token text;
    dispatch_count integer;
    dispatch_index integer;
begin
    if target_max_requests is null
       or target_max_requests not between 1 and 8 then
        raise exception 'invalid_analyzer_dispatch_batch'
            using errcode = '22023';
    end if;

    select secret.decrypted_secret
      into analyzer_endpoint
      from vault.decrypted_secrets secret
     where secret.name = 'kippy_v2_analyzer_endpoint'
     order by secret.created_at desc
     limit 1;

    select secret.decrypted_secret
      into analyzer_trigger_token
      from vault.decrypted_secrets secret
     where secret.name = 'kippy_v2_analyzer_trigger_token'
     order by secret.created_at desc
     limit 1;

    if analyzer_endpoint is null
       or analyzer_endpoint !~
            '^https://[A-Za-z0-9.-]+/functions/v1/v2-analyze-safety-incident$'
       or analyzer_trigger_token is null
       or char_length(analyzer_trigger_token) not between 32 and 256 then
        return 0;
    end if;

    select least(target_max_requests, count(*))::integer
      into dispatch_count
      from public.v2_incident_analysis_jobs job
     where (
            job.state in ('pending', 'retry')
            and job.next_attempt_at <= now()
        )
        or (
            job.state = 'leased'
            and job.lease_expires_at <= now()
        );

    if dispatch_count = 0 then
        return 0;
    end if;

    for dispatch_index in 1..dispatch_count loop
        perform net.http_post(
            url := analyzer_endpoint,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-kippy-analyzer-token', analyzer_trigger_token
            ),
            body := jsonb_build_object(
                'source', 'pg_cron',
                'dispatch_sequence', dispatch_index
            ),
            timeout_milliseconds := 115000
        );
    end loop;

    return dispatch_count;
end;
$$;

comment on function
public.v2_dispatch_expert_analyzer_service(integer) is
    'Fail-closed pg_cron dispatcher for due expert-analysis jobs. Reads only the Edge endpoint and public trigger credential from Vault.';

revoke all on function
public.v2_dispatch_expert_analyzer_service(integer)
from public, anon, authenticated, service_role;

do $$
declare
    existing_job_id bigint;
begin
    select job.jobid
      into existing_job_id
      from cron.job job
     where job.jobname = 'kippy-v2-expert-analyzer';

    if existing_job_id is not null then
        perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
        'kippy-v2-expert-analyzer',
        '* * * * *',
        'select public.v2_dispatch_expert_analyzer_service(4);'
    );
end
$$;

commit;
