begin;

create or replace function public.v2_cmo_create_publication_intent(
    target_resource_type text,
    target_resource_id uuid,
    target_channel text,
    target_approval_id uuid,
    target_content_hash text,
    target_idempotency_key text,
    target_scheduled_for timestamptz default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
    principal_id uuid := public.v2_cmo_require_permission('marketing.publish_intent');
    job_id uuid;
    existing_job public.v2_cmo_publication_jobs%rowtype;
    normalized_content_hash text := pg_catalog.lower(target_content_hash);
begin
    select *
      into existing_job
      from public.v2_cmo_publication_jobs
     where idempotency_key = target_idempotency_key
     for share;

    if found then
        if row(
            existing_job.resource_type,
            existing_job.resource_id,
            existing_job.channel,
            existing_job.approval_id,
            existing_job.content_hash,
            existing_job.scheduled_for
        ) is distinct from row(
            target_resource_type,
            target_resource_id,
            target_channel,
            target_approval_id,
            normalized_content_hash,
            target_scheduled_for
        ) then
            raise exception 'publication_idempotency_conflict'
                using errcode = '23505';
        end if;
        return existing_job.id;
    end if;

    if target_scheduled_for is not null
       and target_scheduled_for <= pg_catalog.now() then
        raise exception 'scheduled_time_must_be_future' using errcode = '22023';
    end if;

    insert into public.v2_cmo_publication_jobs (
        resource_type,
        resource_id,
        channel,
        scheduled_for,
        idempotency_key,
        approval_id,
        content_hash,
        requested_by,
        status
    ) values (
        target_resource_type,
        target_resource_id,
        target_channel,
        target_scheduled_for,
        target_idempotency_key,
        target_approval_id,
        normalized_content_hash,
        principal_id,
        case
            when target_scheduled_for is not null
                then 'SCHEDULED'::public.v2_cmo_workflow_status
            else 'APPROVED'::public.v2_cmo_workflow_status
        end
    )
    on conflict (idempotency_key) do nothing
    returning id into job_id;

    if job_id is null then
        -- ON CONFLICT may wait for an uncommitted competing insert that was
        -- invisible to this call's first statement snapshot. This separate
        -- statement receives the committed row under READ COMMITTED.
        select *
          into existing_job
          from public.v2_cmo_publication_jobs
         where idempotency_key = target_idempotency_key
         for share;

        if not found then
            raise exception 'publication_idempotency_retry_required'
                using errcode = '40001';
        end if;
        if row(
            existing_job.resource_type,
            existing_job.resource_id,
            existing_job.channel,
            existing_job.approval_id,
            existing_job.content_hash,
            existing_job.scheduled_for
        ) is distinct from row(
            target_resource_type,
            target_resource_id,
            target_channel,
            target_approval_id,
            normalized_content_hash,
            target_scheduled_for
        ) then
            raise exception 'publication_idempotency_conflict'
                using errcode = '23505';
        end if;
        return existing_job.id;
    end if;

    perform public.v2_cmo_write_audit_internal(
        principal_id,
        'PUBLICATION_INTENT_CREATED',
        'PUBLICATION_JOB',
        job_id,
        pg_catalog.jsonb_build_object(
            'resource_id', target_resource_id,
            'channel', target_channel
        )
    );
    return job_id;
end;
$$;

revoke all on function public.v2_cmo_create_publication_intent(
    text, uuid, text, uuid, text, text, timestamptz
) from public, anon, service_role;
grant execute on function public.v2_cmo_create_publication_intent(
    text, uuid, text, uuid, text, text, timestamptz
) to authenticated;

comment on function public.v2_cmo_create_publication_intent(
    text, uuid, text, uuid, text, text, timestamptz
) is
    'Creates an atomic reviewable publication intent; identical idempotent replays return the original UUID and conflicting replays fail closed.';

commit;
