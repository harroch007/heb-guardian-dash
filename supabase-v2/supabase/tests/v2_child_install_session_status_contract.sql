begin;

insert into auth.users (id)
values
    ('15100000-0000-0000-0000-000000000001'),
    ('15100000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '15100000-0000-0000-0000-000000000001',
    true
);

select *
  from public.v2_bootstrap_guardian(
      '25100000-0000-4000-8000-000000000001',
      'Install Status Guardian',
      null,
      'install-status-bootstrap-0001'
  );

select *
  from public.v2_create_guardian_child(
      '35100000-0000-4000-8000-000000000001',
      '25100000-0000-4000-8000-000000000001',
      'Install Status Child',
      2015::smallint,
      'female',
      'install-status-child-0001'
  );

reset role;

insert into public.v2_child_install_sessions (
    id,
    child_id,
    created_by,
    activation_token_hash,
    status,
    expires_at,
    created_at
) values (
    '45100000-0000-4000-8000-000000000001',
    '35100000-0000-4000-8000-000000000001',
    '15100000-0000-0000-0000-000000000001',
    repeat('a', 64),
    'created',
    now() - interval '10 minutes',
    now() - interval '20 minutes'
);

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '15100000-0000-0000-0000-000000000001',
    true
);

do $$
declare
    resolved record;
begin
    select *
      into resolved
      from public.v2_get_child_install_session_status(
          '45100000-0000-4000-8000-000000000001'
      );

    if resolved.status <> 'expired'
       or resolved.expires_at is null then
        raise exception 'Install session status was not resolved safely: %', resolved;
    end if;
end
$$;

select set_config(
    'request.jwt.claim.sub',
    '15100000-0000-0000-0000-000000000002',
    true
);

do $$
begin
    if exists (
        select 1
          from public.v2_get_child_install_session_status(
              '45100000-0000-4000-8000-000000000001'
          )
    ) then
        raise exception 'Another guardian can read the install session status';
    end if;
end
$$;

reset role;

do $$
begin
    if has_function_privilege(
        'anon',
        'public.v2_get_child_install_session_status(uuid)',
        'EXECUTE'
    ) then
        raise exception 'Anon can execute the install session status function';
    end if;
end
$$;

rollback;
