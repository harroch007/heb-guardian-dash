begin;

insert into auth.users (id)
values
    ('15000000-0000-0000-0000-000000000001'),
    ('15000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config(
    'request.jwt.claim.sub',
    '15000000-0000-0000-0000-000000000001',
    true
);

do $$
declare
    first_bootstrap record;
    repeated_bootstrap record;
    first_child record;
    repeated_child record;
begin
    select *
      into first_bootstrap
      from public.v2_bootstrap_guardian(
          '25000000-0000-4000-8000-000000000001',
          'Guardian One',
          '+972 50-123-4567',
          'guardian-bootstrap-contract-0001'
      );
    if first_bootstrap.family_id <>
           '25000000-0000-4000-8000-000000000001'
       or not first_bootstrap.created then
        raise exception 'Guardian bootstrap failed: %', first_bootstrap;
    end if;

    select *
      into repeated_bootstrap
      from public.v2_bootstrap_guardian(
          '25000000-0000-4000-8000-000000000099',
          'Guardian One Updated',
          '+972 50-123-4567',
          'guardian-bootstrap-contract-0001-retry'
      );
    if repeated_bootstrap.family_id <> first_bootstrap.family_id
       or repeated_bootstrap.created then
        raise exception
            'Guardian bootstrap was not idempotent: %',
            repeated_bootstrap;
    end if;

    select *
      into first_child
      from public.v2_create_guardian_child(
          '35000000-0000-4000-8000-000000000001',
          first_bootstrap.family_id,
          'Child One',
          2015::smallint,
          'female',
          'guardian-child-contract-0001'
      );
    select *
      into repeated_child
      from public.v2_create_guardian_child(
          '35000000-0000-4000-8000-000000000001',
          first_bootstrap.family_id,
          'Child One',
          2015::smallint,
          'female',
          'guardian-child-contract-0001'
      );
    if not first_child.created
       or repeated_child.created
       or repeated_child.child_id <> first_child.child_id then
        raise exception
            'Guardian child creation was not idempotent: first=%, retry=%',
            first_child,
            repeated_child;
    end if;
end
$$;

select set_config(
    'request.jwt.claim.sub',
    '15000000-0000-0000-0000-000000000002',
    true
);

do $$
declare
    second_family_id uuid;
begin
    select family_id
      into second_family_id
      from public.v2_bootstrap_guardian(
          '25000000-0000-4000-8000-000000000002',
          'Guardian Two',
          null,
          'guardian-bootstrap-contract-0002'
      );

    begin
        perform public.v2_create_guardian_child(
            '35000000-0000-4000-8000-000000000002',
            '25000000-0000-4000-8000-000000000001',
            'Cross Family Child',
            2016::smallint,
            'male',
            'guardian-child-cross-family'
        );
        raise exception 'Cross-family child creation was accepted';
    exception
        when insufficient_privilege then null;
    end;

    if (
        select count(*)
          from public.v2_children
    ) <> 0 then
        raise exception 'Second guardian can see another family child';
    end if;
end
$$;

reset role;

do $$
begin
    if has_function_privilege(
        'anon',
        'public.v2_bootstrap_guardian(uuid,text,text,text)',
        'EXECUTE'
    ) or has_function_privilege(
        'anon',
        'public.v2_create_guardian_child(uuid,uuid,text,smallint,text,text)',
        'EXECUTE'
    ) then
        raise exception 'Anon can execute guardian portal functions';
    end if;
end
$$;

rollback;
