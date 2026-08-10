begin;

alter table public.v2_incident_analysis
    add column if not exists guidance_age_band text
        check (
            guidance_age_band is null
            or guidance_age_band in (
                'age_6_8', 'age_9_11', 'age_12_14', 'unknown'
            )
        ),
    add column if not exists guidance_codes text[] not null default '{}',
    add column if not exists parent_opening text
        check (
            parent_opening is null
            or char_length(parent_opening) between 1 and 600
        ),
    add column if not exists parent_avoid text
        check (
            parent_avoid is null
            or char_length(parent_avoid) between 1 and 600
        ),
    add column if not exists parent_next_action text
        check (
            parent_next_action is null
            or char_length(parent_next_action) between 1 and 600
        );

create or replace function public.v2_child_age_band(
    target_birth_year smallint,
    target_year integer default extract(year from now())::integer
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select case
        when target_birth_year is null then 'unknown'
        when target_year - target_birth_year between 6 and 8 then 'age_6_8'
        when target_year - target_birth_year between 9 and 11 then 'age_9_11'
        when target_year - target_birth_year between 12 and 14 then 'age_12_14'
        else 'unknown'
    end;
$$;

create or replace function public.v2_parent_guidance_codes(
    target_category text,
    target_severity text,
    target_action_code text
)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
    select array_remove(array[
        'START_WITH_OPEN_QUESTION',
        'VALIDATE_BEFORE_ADVISING',
        'DO_NOT_BLAME_CHILD',
        case
            when target_category in (
                'grooming', 'stranger_contact', 'sexual_content'
            ) then 'DO_NOT_CONFRONT_SENDER_YET'
        end,
        case
            when target_action_code in (
                'preserve_and_report', 'restrict_contact',
                'professional_support', 'urgent_intervention'
            ) then 'PRESERVE_EVIDENCE'
        end,
        case
            when target_severity in ('high', 'critical')
              or target_category in ('violence', 'self_harm')
                then 'CHECK_IMMEDIATE_SAFETY'
        end,
        case
            when target_category in ('bullying', 'exclusion')
                then 'CONSIDER_SCHOOL_INVOLVEMENT'
        end,
        case
            when target_action_code in (
                'professional_support', 'urgent_intervention'
            ) then 'CONSIDER_PROFESSIONAL_SUPPORT'
        end,
        case
            when target_action_code = 'restrict_contact'
                then 'RESTRICT_OR_BLOCK_CONTACT'
        end,
        case
            when target_severity = 'critical'
                then 'CONTACT_EMERGENCY_SERVICES'
        end
    ]::text[], null);
$$;

create or replace function public.v2_parent_opening_template(
    target_age_band text,
    target_category text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case target_age_band
        when 'age_6_8' then
            'אפשר לשבת איתי רגע? ראיתי משהו שאולי לא היה לך נעים. את/ה לא בצרות ואני רוצה קודם לשמוע איך הרגשת.'
        when 'age_9_11' then
            'רוצה לספר לי מה קרה בשיחה הזאת מנקודת המבט שלך? אני כאן להקשיב, לא לשפוט ולא לקחת לך מיד את הטלפון.'
        when 'age_12_14' then
            'שמתי לב למשהו שמדאיג אותי. חשוב לי להבין את ההקשר ממך לפני שאעשה משהו. איך את/ה רואה את מה שקרה?'
        else
            'שמתי לב למשהו שאולי דורש תשומת לב. אפשר להבין ממך מה קרה ואיך זה הרגיש לך?'
    end;
$$;

create or replace function public.v2_parent_avoid_template(
    target_category text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case
        when target_category in (
            'grooming', 'stranger_contact', 'sexual_content'
        ) then
            'לא להאשים את הילד/ה, לא לאיים בשלילת הטלפון, ולא לפנות לשולח לפני שביררתם ושמרתם ראיות.'
        when target_category in ('bullying', 'exclusion') then
            'לא לבטל את החוויה כ״צחוק״, לא לחקור בלחץ, ולא לפנות מיד לילדים אחרים לפני שמבינים אם פעולה כזאת תחריף את המצב.'
        when target_category in ('violence', 'self_harm') then
            'לא להשאיר את הילד/ה לבד עם החשש, לא להבטיח סודיות מוחלטת, ולא לדחות בדיקת סכנה מיידית.'
        else
            'לא להאשים, לא להטיף ולא לקבל החלטה לפני ששומעים את הילד/ה ומבינים את ההקשר.'
    end;
$$;

create or replace function public.v2_parent_next_action_template(
    target_category text,
    target_severity text,
    target_action_code text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
    select case
        when target_severity = 'critical' then
            'בדקו עכשיו סכנה מיידית. אם יש חשש ממשי לפגיעה, פנו ללא דיחוי לגורם חירום או לאיש מקצוע מתאים.'
        when target_category in ('bullying', 'exclusion') then
            'תעדו את האירוע, בדקו אם הוא חוזר, ובמידת הצורך פנו יחד עם הילד/ה למחנך/ת או למסגרת הרלוונטית.'
        when target_category in (
            'grooming', 'stranger_contact', 'sexual_content'
        ) then
            'שמרו ראיות, בדקו אם נמסרו פרטים אישיים, והחליטו עם הילד/ה על חסימה או דיווח בלי לנהל עימות עצמאי עם השולח.'
        when target_action_code = 'professional_support' then
            'קבעו שיחה קרובה עם איש או אשת מקצוע והמשיכו לעקוב ברוגע אחר שינוי בהתנהגות או במצב הרוח.'
        else
            'נהלו שיחה רגועה היום, סכמו יחד צעד אחד מעשי, ובדקו שוב בהמשך אם המצב נמשך או מחמיר.'
    end;
$$;

create or replace function public.v2_apply_parent_guidance_internal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    incident_row record;
    resolved_age_band text;
begin
    if new.outcome = 'dismissed' then
        new.guidance_age_band := null;
        new.guidance_codes := '{}';
        new.parent_opening := null;
        new.parent_avoid := null;
        new.parent_next_action := null;
        return new;
    end if;

    select incident.category,
           incident.severity,
           child.birth_year
      into incident_row
      from public.v2_safety_incidents incident
      join public.v2_children child on child.id = incident.child_id
     where incident.id = new.incident_id;
    if not found then
        raise exception 'incident_guidance_context_missing';
    end if;
    resolved_age_band := public.v2_child_age_band(
        incident_row.birth_year
    );
    new.guidance_age_band := resolved_age_band;
    new.guidance_codes := public.v2_parent_guidance_codes(
        incident_row.category,
        incident_row.severity,
        new.action_code
    );
    new.parent_opening := public.v2_parent_opening_template(
        resolved_age_band,
        incident_row.category
    );
    new.parent_avoid := public.v2_parent_avoid_template(
        incident_row.category
    );
    new.parent_next_action := public.v2_parent_next_action_template(
        incident_row.category,
        incident_row.severity,
        new.action_code
    );
    return new;
end;
$$;

drop trigger if exists v2_incident_analysis_apply_parent_guidance
on public.v2_incident_analysis;

create trigger v2_incident_analysis_apply_parent_guidance
before insert on public.v2_incident_analysis
for each row execute function public.v2_apply_parent_guidance_internal();

revoke all on function public.v2_apply_parent_guidance_internal()
from public, anon, authenticated;

grant execute on function public.v2_apply_parent_guidance_internal()
to service_role;

commit;
