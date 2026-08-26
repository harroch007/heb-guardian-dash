begin;

alter table public.v2_safety_incidents
    drop constraint if exists v2_safety_incidents_privacy_contract_version_check;

alter table public.v2_safety_incidents
    add constraint v2_safety_incidents_privacy_contract_version_check
    check (privacy_contract_version in (1, 2));

comment on constraint v2_safety_incidents_privacy_contract_version_check
on public.v2_safety_incidents is
    'v1 is the legacy sanitized FIFO. v2 adds non-identifying age-band, relationship, conversation-setting and local trend context.';

do $$
declare
    function_signature constant text :=
        'public.v2_submit_safety_incident_service(uuid,uuid,text,text,text,real,real,timestamp with time zone,smallint,smallint,bigint,text,text,integer,smallint,timestamp with time zone)';
    previous_definition text;
    upgraded_definition text;
begin
    previous_definition := pg_get_functiondef(
        function_signature::regprocedure
    );
    if position(
        'target_privacy_contract_version <> 1'
        in previous_definition
    ) = 0 then
        raise exception 'unexpected_incident_submit_function_definition';
    end if;
    upgraded_definition := replace(
        previous_definition,
        'target_privacy_contract_version <> 1',
        'target_privacy_contract_version not in (1, 2)'
    );
    execute upgraded_definition;
end;
$$;

do $$
declare
    function_signature constant text :=
        'public.v2_finalize_incident_analysis_service(text,uuid,text,uuid,text,text,text,text,text,text[],text,text,text,text,real,text[],text[])';
    previous_definition text;
    upgraded_definition text;
begin
    previous_definition := pg_get_functiondef(
        function_signature::regprocedure
    );
    if position('kippy-expert-v3' in previous_definition) = 0 then
        raise exception 'unexpected_expert_finalizer_definition';
    end if;
    upgraded_definition := replace(
        previous_definition,
        'kippy-expert-v3',
        'kippy-expert-v4'
    );
    execute upgraded_definition;
end;
$$;

commit;
