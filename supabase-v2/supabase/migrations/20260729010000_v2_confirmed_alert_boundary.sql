begin;

lock table public.v2_safety_incidents,
    public.v2_alert_deliveries
in access exclusive mode;

do $$
begin
    if exists (
        select 1
        from public.v2_safety_incidents incident
        where incident.status in ('confirmed', 'alerted')
    )
       or exists (
            select 1
            from public.v2_alert_deliveries
       ) then
        raise exception
            'confirmed_alert_migration_requires_empty_legacy_alert_state'
            using errcode = '23514';
    end if;
end
$$;

alter table public.v2_safety_incidents
    drop constraint if exists v2_safety_incidents_status_check;

alter table public.v2_safety_incidents
    add constraint v2_safety_incidents_status_check
    check (
        status in (
            'received',
            'analyzing',
            'confirmed',
            'dismissed',
            'analysis_failed',
            'alerted'
        )
    );

create table public.v2_incident_analysis (
    incident_id uuid primary key
        references public.v2_safety_incidents(id) on delete cascade,
    outcome text not null
        check (
            outcome in (
                'confirmed',
                'dismissed'
            )
        ),
    reason_code text not null
        check (
            reason_code in (
                'bullying_pattern',
                'exclusion_pattern',
                'sexual_risk',
                'violence_risk',
                'grooming_risk',
                'manipulation_risk',
                'stranger_contact_risk',
                'self_harm_risk',
                'other_safety_risk',
                'no_actionable_risk'
            )
        ),
    action_code text not null
        check (
            action_code in (
                'supportive_conversation',
                'preserve_and_report',
                'restrict_contact',
                'professional_support',
                'urgent_intervention',
                'no_action'
            )
        ),
    safe_summary text
        check (
            safe_summary is null
            or char_length(safe_summary) between 1 and 1200
        ),
    safe_reason text
        check (
            safe_reason is null
            or char_length(safe_reason) between 1 and 1200
        ),
    recommended_action text
        check (
            recommended_action is null
            or char_length(recommended_action) between 1 and 600
        ),
    model_provider text not null
        check (char_length(model_provider) between 1 and 80),
    model_name text not null
        check (char_length(model_name) between 1 and 120),
    model_version text not null
        check (char_length(model_version) between 1 and 80),
    prompt_version text not null
        check (char_length(prompt_version) between 1 and 80),
    analysis_contract_version smallint not null
        check (analysis_contract_version = 2),
    analyzed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    check (
        (
            outcome = 'confirmed'
            and reason_code <> 'no_actionable_risk'
            and action_code <> 'no_action'
            and safe_summary is not null
            and safe_reason is not null
            and recommended_action is not null
        )
        or (
            outcome = 'dismissed'
            and reason_code = 'no_actionable_risk'
            and action_code = 'no_action'
            and safe_summary is null
            and safe_reason is null
            and recommended_action is null
        )
    )
);

comment on table public.v2_incident_analysis is
    'Parent-safe expert analysis only. Raw conversation context remains encrypted in v2_incident_context.';

alter table public.v2_incident_analysis enable row level security;
alter table public.v2_incident_analysis force row level security;

create or replace function
public.v2_guardian_can_read_confirmed_incident(
    target_incident_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.v2_safety_incidents incident
        join public.v2_incident_analysis analysis
          on analysis.incident_id = incident.id
         and analysis.outcome = 'confirmed'
        join public.v2_children child
          on child.id = incident.child_id
        where incident.id = target_incident_id
          and incident.status in ('confirmed', 'alerted')
          and public.v2_is_family_guardian(child.family_id)
    );
$$;

revoke all on function
public.v2_guardian_can_read_confirmed_incident(uuid)
from public, anon;

grant execute on function
public.v2_guardian_can_read_confirmed_incident(uuid)
to authenticated;

drop policy if exists v2_guardians_read_incidents
on public.v2_safety_incidents;

create policy v2_guardians_read_confirmed_incidents
on public.v2_safety_incidents for select
to authenticated
using (
    public.v2_guardian_can_read_confirmed_incident(id)
);

create policy v2_guardians_read_confirmed_analysis
on public.v2_incident_analysis for select
to authenticated
using (
    outcome = 'confirmed'
    and public.v2_guardian_can_read_confirmed_incident(
        incident_id
    )
);

revoke all on table public.v2_incident_analysis
from public, anon, authenticated, service_role;

grant select on table public.v2_incident_analysis
to authenticated;

create or replace function public.v2_guard_incident_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    valid_transition boolean;
begin
    if tg_op = 'INSERT' then
        if new.status <> 'received' then
            raise exception 'incident_must_start_received'
                using errcode = '23514';
        end if;
        return new;
    end if;

    valid_transition := case old.status
        when 'received' then new.status in (
            'received',
            'analyzing',
            'confirmed',
            'dismissed',
            'analysis_failed'
        )
        when 'analyzing' then new.status in (
            'analyzing',
            'confirmed',
            'dismissed',
            'analysis_failed'
        )
        when 'confirmed' then new.status in (
            'confirmed',
            'alerted'
        )
        when 'alerted' then new.status = 'alerted'
        when 'dismissed' then new.status = 'dismissed'
        when 'analysis_failed' then new.status = 'analysis_failed'
        else false
    end;

    if not valid_transition then
        raise exception 'invalid_incident_status_transition'
            using errcode = '23514';
    end if;

    if new.status in ('confirmed', 'alerted')
       and not exists (
            select 1
            from public.v2_incident_analysis analysis
            where analysis.incident_id = new.id
              and analysis.outcome = 'confirmed'
       ) then
        raise exception 'confirmed_analysis_required'
            using errcode = '23514';
    end if;

    return new;
end;
$$;

create trigger v2_safety_incidents_guard_insert
before insert on public.v2_safety_incidents
for each row execute function public.v2_guard_incident_status();

create trigger v2_safety_incidents_guard_update
before update of status on public.v2_safety_incidents
for each row execute function public.v2_guard_incident_status();

create or replace function public.v2_keep_analysis_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' then
        raise exception 'incident_analysis_is_immutable'
            using errcode = '23514';
    end if;

    if exists (
        select 1
        from public.v2_safety_incidents incident
        where incident.id = old.incident_id
    ) then
        raise exception 'incident_analysis_delete_requires_incident_delete'
            using errcode = '23514';
    end if;

    return old;
end;
$$;

create trigger v2_incident_analysis_immutable_update
before update on public.v2_incident_analysis
for each row execute function public.v2_keep_analysis_immutable();

create trigger v2_incident_analysis_immutable_delete
before delete on public.v2_incident_analysis
for each row execute function public.v2_keep_analysis_immutable();

alter table public.v2_alert_deliveries
    add constraint v2_alert_deliveries_incident_guardian_channel_key
    unique (incident_id, guardian_user_id, channel);

create or replace function public.v2_require_confirmed_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.v2_safety_incidents incident
        join public.v2_incident_analysis analysis
          on analysis.incident_id = incident.id
        where incident.id = new.incident_id
          and incident.status in ('confirmed', 'alerted')
          and analysis.outcome = 'confirmed'
    ) then
        raise exception 'confirmed_incident_required'
            using errcode = '23514';
    end if;
    return new;
end;
$$;

create trigger v2_alert_deliveries_require_confirmation
before insert or update of incident_id
on public.v2_alert_deliveries
for each row execute function public.v2_require_confirmed_alert();

create or replace function public.v2_parent_summary_template(
    target_category text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case target_category
        when 'bullying' then
            'זוהה דפוס בריונות שעשוי להצדיק מעורבות הורית.'
        when 'exclusion' then
            'זוהה דפוס של הדרה חברתית שעשוי להצדיק מעורבות הורית.'
        when 'sexual_content' then
            'זוהה סיכון הקשור לתוכן או לשיח מיני.'
        when 'violence' then
            'זוהה סיכון הקשור לאלימות או לאיום ממשי.'
        when 'grooming' then
            'זוהה דפוס שעלול להתאים לניסיון טיפוח או ניצול.'
        when 'manipulation' then
            'זוהה דפוס של לחץ או מניפולציה.'
        when 'stranger_contact' then
            'זוהה סיכון הקשור לפנייה מאדם שאינו מוכר.'
        when 'self_harm' then
            'זוהה חשש הקשור לפגיעה עצמית.'
        when 'other' then
            'זוהה חשש בטיחותי שעשוי להצדיק מעורבות הורית.'
    end;
$$;

create or replace function public.v2_parent_reason_template(
    target_reason_code text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case target_reason_code
        when 'bullying_pattern' then
            'ההקשר מצביע על דפוס פוגעני ולא רק על אמירה בודדת או הומור הדדי.'
        when 'exclusion_pattern' then
            'ההקשר מצביע על הדרה או דחייה חברתית בעלת משמעות.'
        when 'sexual_risk' then
            'ההקשר מצביע על חציית גבול מיני או על חשיפה שאינה מתאימה לגיל.'
        when 'violence_risk' then
            'ההקשר מצביע על איום או על סיכון אלים שדורש תשומת לב.'
        when 'grooming_risk' then
            'ההקשר מצביע על בניית אמון לצורך לחץ, סודיות או ניצול.'
        when 'manipulation_risk' then
            'ההקשר מצביע על לחץ, שליטה או מניפולציה מתמשכת.'
        when 'stranger_contact_risk' then
            'ההקשר מצביע על פנייה מאדם לא מוכר ועל ניסיון להעמיק קשר.'
        when 'self_harm_risk' then
            'ההקשר מצביע על מצוקה או על אפשרות לפגיעה עצמית.'
        when 'other_safety_risk' then
            'ההקשר המלא מצביע על חשש בטיחותי ממשי.'
    end;
$$;

create or replace function public.v2_parent_action_template(
    target_action_code text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case target_action_code
        when 'supportive_conversation' then
            'מומלץ לפתוח בשיחה רגועה ותומכת עם הילד או הילדה.'
        when 'preserve_and_report' then
            'מומלץ לשמור את המידע הרלוונטי ולשקול דיווח לגורם המתאים.'
        when 'restrict_contact' then
            'מומלץ להגביל את הקשר ולבדוק יחד את הגדרות החסימה והפרטיות.'
        when 'professional_support' then
            'מומלץ לערב איש או אשת מקצוע מתאימים.'
        when 'urgent_intervention' then
            'מומלץ לפעול מיד ולפנות לגורם חירום או מקצועי מתאים.'
    end;
$$;

create or replace function public.v2_reason_matches_category(
    target_outcome text,
    target_category text,
    target_reason_code text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select coalesce(
        case target_outcome
            when 'dismissed' then
                target_reason_code = 'no_actionable_risk'
            when 'confirmed' then
                target_reason_code = case target_category
                    when 'bullying' then 'bullying_pattern'
                    when 'exclusion' then 'exclusion_pattern'
                    when 'sexual_content' then 'sexual_risk'
                    when 'violence' then 'violence_risk'
                    when 'grooming' then 'grooming_risk'
                    when 'manipulation' then 'manipulation_risk'
                    when 'stranger_contact' then
                        'stranger_contact_risk'
                    when 'self_harm' then 'self_harm_risk'
                    when 'other' then 'other_safety_risk'
                end
            else false
        end,
        false
    );
$$;

create or replace function public.v2_action_matches_severity(
    target_outcome text,
    target_severity text,
    target_action_code text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
    select coalesce(
        case target_outcome
            when 'dismissed' then
                target_action_code = 'no_action'
            when 'confirmed' then
                case target_severity
                    when 'low' then target_action_code = any (
                        array[
                            'supportive_conversation',
                            'preserve_and_report',
                            'restrict_contact'
                        ]::text[]
                    )
                    when 'medium' then target_action_code = any (
                        array[
                            'supportive_conversation',
                            'preserve_and_report',
                            'restrict_contact',
                            'professional_support'
                        ]::text[]
                    )
                    when 'high' then target_action_code = any (
                        array[
                            'preserve_and_report',
                            'restrict_contact',
                            'professional_support',
                            'urgent_intervention'
                        ]::text[]
                    )
                    when 'critical' then target_action_code = any (
                        array[
                            'professional_support',
                            'urgent_intervention'
                        ]::text[]
                    )
                    else false
                end
            else false
        end,
        false
    );
$$;

create or replace function public.v2_finalize_incident_analysis_internal(
    target_incident_id uuid,
    target_outcome text,
    target_reason_code text,
    target_action_code text,
    target_expert_category text,
    target_model_provider text,
    target_model_name text,
    target_model_version text,
    target_prompt_version text,
    target_analysis_contract_version smallint
)
returns table (
    incident_status text,
    analysis_outcome text,
    delivery_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_status text;
    resolved_status text;
    resolved_safe_summary text;
    resolved_safe_reason text;
    resolved_recommended_action text;
    existing_analysis public.v2_incident_analysis%rowtype;
    created_delivery_count integer := 0;
begin
    if target_outcome is null
       or target_outcome not in (
        'confirmed',
        'dismissed'
    )
       or target_model_provider is null
       or char_length(target_model_provider) not between 1 and 80
       or target_model_name is null
       or char_length(target_model_name) not between 1 and 120
       or target_model_version is null
       or char_length(target_model_version) not between 1 and 80
       or target_prompt_version is null
       or char_length(target_prompt_version) not between 1 and 80
       or target_analysis_contract_version is null
       or target_analysis_contract_version <> 2
       or target_expert_category is null
       or target_expert_category not in (
            'bullying',
            'exclusion',
            'sexual_content',
            'violence',
            'grooming',
            'manipulation',
            'stranger_contact',
            'self_harm',
            'other'
       )
       or target_reason_code is null
       or target_reason_code not in (
            'bullying_pattern',
            'exclusion_pattern',
            'sexual_risk',
            'violence_risk',
            'grooming_risk',
            'manipulation_risk',
            'stranger_contact_risk',
            'self_harm_risk',
            'other_safety_risk',
            'no_actionable_risk'
       )
       or target_action_code is null
       or target_action_code not in (
            'supportive_conversation',
            'preserve_and_report',
            'restrict_contact',
            'professional_support',
            'urgent_intervention',
            'no_action'
       ) then
        raise exception 'invalid_incident_analysis'
            using errcode = '22023';
    end if;

    if (
        target_outcome = 'confirmed'
        and (
            target_reason_code = 'no_actionable_risk'
            or target_action_code = 'no_action'
        )
    ) or (
        target_outcome = 'dismissed'
        and (
            target_reason_code <> 'no_actionable_risk'
            or target_action_code <> 'no_action'
        )
    ) or not public.v2_reason_matches_category(
        target_outcome,
        target_expert_category,
        target_reason_code
    ) then
        raise exception 'invalid_parent_projection_codes'
            using errcode = '22023';
    end if;

    resolved_safe_summary := case
        when target_outcome = 'confirmed' then
            public.v2_parent_summary_template(
                target_expert_category
            )
    end;
    resolved_safe_reason := case
        when target_outcome = 'confirmed' then
            public.v2_parent_reason_template(
                target_reason_code
            )
    end;
    resolved_recommended_action := case
        when target_outcome = 'confirmed' then
            public.v2_parent_action_template(
                target_action_code
            )
    end;

    select incident.status
      into current_status
      from public.v2_safety_incidents incident
     where incident.id = target_incident_id
     for update;

    if current_status is null then
        raise exception 'incident_not_found'
            using errcode = 'P0002';
    end if;

    select analysis.*
      into existing_analysis
      from public.v2_incident_analysis analysis
     where analysis.incident_id = target_incident_id;

    if found then
        if existing_analysis.outcome <> target_outcome
           or existing_analysis.reason_code <> target_reason_code
           or existing_analysis.action_code <> target_action_code
           or existing_analysis.safe_summary
                is distinct from resolved_safe_summary
           or existing_analysis.safe_reason
                is distinct from resolved_safe_reason
           or existing_analysis.recommended_action
                is distinct from resolved_recommended_action
           or existing_analysis.model_provider
                <> target_model_provider
           or existing_analysis.model_name <> target_model_name
           or existing_analysis.model_version
                <> target_model_version
           or existing_analysis.prompt_version
                <> target_prompt_version
           or existing_analysis.analysis_contract_version
                <> target_analysis_contract_version then
            raise exception 'incident_analysis_conflict'
                using errcode = '23505';
        end if;

        return query
        select
            current_status,
            existing_analysis.outcome,
            (
                select count(*)::integer
                from public.v2_alert_deliveries delivery
                where delivery.incident_id =
                    target_incident_id
            );
        return;
    end if;

    insert into public.v2_incident_analysis (
        incident_id,
        outcome,
        reason_code,
        action_code,
        safe_summary,
        safe_reason,
        recommended_action,
        model_provider,
        model_name,
        model_version,
        prompt_version,
        analysis_contract_version
    )
    values (
        target_incident_id,
        target_outcome,
        target_reason_code,
        target_action_code,
        resolved_safe_summary,
        resolved_safe_reason,
        resolved_recommended_action,
        target_model_provider,
        target_model_name,
        target_model_version,
        target_prompt_version,
        target_analysis_contract_version
    );

    resolved_status := case target_outcome
        when 'confirmed' then 'confirmed'
        else 'dismissed'
    end;

    update public.v2_safety_incidents incident
       set status = resolved_status
     where incident.id = target_incident_id;

    if target_outcome = 'confirmed' then
        insert into public.v2_alert_deliveries (
            incident_id,
            guardian_user_id,
            channel,
            idempotency_key
        )
        select
            target_incident_id,
            membership.guardian_user_id,
            'in_app',
            'v2:' || target_incident_id::text || ':' ||
                membership.guardian_user_id::text || ':in_app'
        from public.v2_safety_incidents incident
        join public.v2_children child
          on child.id = incident.child_id
        join public.v2_guardian_memberships membership
          on membership.family_id = child.family_id
         and membership.status = 'active'
        where incident.id = target_incident_id
        on conflict (
            incident_id,
            guardian_user_id,
            channel
        ) do nothing;

        get diagnostics created_delivery_count = row_count;
    end if;

    insert into public.v2_audit_events (
        actor_type,
        action,
        object_type,
        object_id,
        outcome,
        metadata
    )
    values (
        'service',
        'v2.incident.analysis.finalize',
        'safety_incident',
        target_incident_id,
        'success',
        jsonb_build_object(
            'analysis_outcome',
            target_outcome
        )
    );

    return query
    select
        resolved_status,
        target_outcome,
        created_delivery_count;
end;
$$;

revoke all on function public.v2_finalize_incident_analysis_internal(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    smallint
) from public, anon, authenticated, service_role;

revoke all on function
    public.v2_parent_summary_template(text),
    public.v2_parent_reason_template(text),
    public.v2_parent_action_template(text),
    public.v2_reason_matches_category(text, text, text),
    public.v2_action_matches_severity(text, text, text)
from public, anon, authenticated, service_role;

commit;
