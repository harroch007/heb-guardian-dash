begin;

alter table public.v2_incident_encryption_keys
    add constraint v2_incident_encryption_keys_version_algorithm_unique
    unique (key_version, algorithm);

alter table public.v2_incident_context
    add constraint v2_incident_context_encryption_key_fk
    foreign key (key_version, encryption_algorithm)
    references public.v2_incident_encryption_keys(key_version, algorithm)
    on update restrict
    on delete restrict;

create or replace function public.v2_validate_incident_encryption_key()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if not exists (
        select 1
          from public.v2_incident_encryption_keys key
         where key.key_version = new.key_version
           and key.algorithm = new.encryption_algorithm
           and key.activates_at <= now()
           and (
               key.status = 'active'
               or (
                   key.status = 'retired'
                   and key.retires_at is not null
                   and key.retires_at > now()
               )
           )
    ) then
        raise exception 'incident_encryption_key_not_accepted'
            using errcode = '22023';
    end if;
    return new;
end;
$$;

create trigger v2_incident_context_validate_encryption_key
before insert or update of key_version, encryption_algorithm
on public.v2_incident_context
for each row execute function public.v2_validate_incident_encryption_key();

commit;
