begin;

alter table public.v2_incident_context
    drop constraint if exists v2_incident_context_message_count_check;

alter table public.v2_incident_context
    add constraint v2_incident_context_message_count_check
    check (message_count between 1 and 60);

comment on constraint v2_incident_context_message_count_check
on public.v2_incident_context is
    'Private conversations submit at most 40 messages; group conversations submit at most 60. The encrypted client contract enforces the type-specific limit.';

commit;
