ALTER TABLE public.alerts
  DROP CONSTRAINT IF EXISTS alerts_category_check;

ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_category_check
  CHECK (
    category IS NULL OR category = ANY (
      ARRAY[
        'friendly_banter'::text,
        'bullying'::text,
        'bullying_victim'::text,
        'bullying_mutual'::text,
        'bullying_aggressor'::text,
        'emotional_distress'::text,
        'inappropriate_content'::text,
        'stranger_danger'::text,
        'offensive_language'::text,
        'geofence'::text
      ]
    )
  );

NOTIFY pgrst, 'reload schema';