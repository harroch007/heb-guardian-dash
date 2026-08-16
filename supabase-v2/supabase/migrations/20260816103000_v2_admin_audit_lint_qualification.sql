begin;

create temporary table v2_admin_audit_lint_fix_before
on commit drop
as
select
    procedure.oid,
    procedure.proowner,
    procedure.prosecdef,
    procedure.proleakproof,
    procedure.proisstrict,
    procedure.provolatile,
    procedure.proparallel,
    procedure.procost,
    procedure.prorows,
    procedure.proacl,
    procedure.proconfig,
    procedure.prosrc,
    pg_get_functiondef(procedure.oid) as definition
from pg_catalog.pg_proc procedure
where procedure.oid = to_regprocedure(
    'public.v2_admin_write_audit_event(text,text,uuid,uuid,text,uuid,text,text[],text,uuid,jsonb)'
);

do $$
declare
    before_snapshot record;
    after_snapshot record;
    expected_definition text;
    expected_source text;
    line_break text;
    declaration_marker text;
    labeled_declaration_marker text;
    ambiguous_expression constant text :=
        'assignment.staff_principal_id = staff_principal_id';
    qualified_expression constant text :=
        'assignment.staff_principal_id = '
        || 'audit_event_context.staff_principal_id';
begin
    if (select count(*) from pg_temp.v2_admin_audit_lint_fix_before) <> 1 then
        raise exception 'v2_admin_write_audit_event_missing';
    end if;

    select snapshot.*
      into strict before_snapshot
      from pg_temp.v2_admin_audit_lint_fix_before snapshot;

    if (
        length(before_snapshot.definition)
        - length(replace(
            before_snapshot.definition,
            ambiguous_expression,
            ''
        ))
    ) <> length(ambiguous_expression) then
        raise exception 'v2_admin_write_audit_event_unexpected_source';
    end if;

    line_break := case
        when position(chr(13) || chr(10) in before_snapshot.prosrc) > 0
            then chr(13) || chr(10)
        else chr(10)
    end;
    declaration_marker := line_break || 'declare' || line_break;
    labeled_declaration_marker :=
        line_break
        || '<<audit_event_context>>'
        || line_break
        || 'declare'
        || line_break;

    if (
        length(before_snapshot.prosrc)
        - length(replace(
            before_snapshot.prosrc,
            declaration_marker,
            ''
        ))
    ) <> length(declaration_marker) then
        raise exception 'v2_admin_write_audit_event_unexpected_block';
    end if;

    expected_source := replace(
        before_snapshot.prosrc,
        declaration_marker,
        labeled_declaration_marker
    );
    expected_source := replace(
        expected_source,
        ambiguous_expression,
        qualified_expression
    );

    if (
        length(before_snapshot.definition)
        - length(replace(
            before_snapshot.definition,
            before_snapshot.prosrc,
            ''
        ))
    ) <> length(before_snapshot.prosrc) then
        raise exception 'v2_admin_write_audit_event_unexpected_definition';
    end if;

    expected_definition := replace(
        before_snapshot.definition,
        before_snapshot.prosrc,
        expected_source
    );

    execute expected_definition;

    select
        procedure.oid,
        procedure.proowner,
        procedure.prosecdef,
        procedure.proleakproof,
        procedure.proisstrict,
        procedure.provolatile,
        procedure.proparallel,
        procedure.procost,
        procedure.prorows,
        procedure.proacl,
        procedure.proconfig,
        procedure.prosrc,
        pg_get_functiondef(procedure.oid) as definition
      into strict after_snapshot
      from pg_catalog.pg_proc procedure
     where procedure.oid = to_regprocedure(
        'public.v2_admin_write_audit_event(text,text,uuid,uuid,text,uuid,text,text[],text,uuid,jsonb)'
     );

    if after_snapshot.prosrc is distinct from expected_source
       or after_snapshot.definition is distinct from expected_definition then
        raise exception 'v2_admin_write_audit_event_semantics_changed';
    end if;

    if row(
        after_snapshot.oid,
        after_snapshot.proowner,
        after_snapshot.prosecdef,
        after_snapshot.proleakproof,
        after_snapshot.proisstrict,
        after_snapshot.provolatile,
        after_snapshot.proparallel,
        after_snapshot.procost,
        after_snapshot.prorows,
        after_snapshot.proacl,
        after_snapshot.proconfig
    ) is distinct from row(
        before_snapshot.oid,
        before_snapshot.proowner,
        before_snapshot.prosecdef,
        before_snapshot.proleakproof,
        before_snapshot.proisstrict,
        before_snapshot.provolatile,
        before_snapshot.proparallel,
        before_snapshot.procost,
        before_snapshot.prorows,
        before_snapshot.proacl,
        before_snapshot.proconfig
    ) then
        raise exception 'v2_admin_write_audit_event_metadata_changed';
    end if;
end;
$$;

commit;
