
-- טבלת מודלים זמינים
CREATE TABLE public.ai_model_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  weight integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_model_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage model config"
  ON public.ai_model_config FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Seed current model
INSERT INTO ai_model_config (model_name, is_default, weight, description)
VALUES ('gpt-4.1', true, 100, 'מודל ייצור נוכחי');

-- טבלת שיוך ילד למודל (override)
CREATE TABLE public.child_model_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(child_id)
);

ALTER TABLE public.child_model_override ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage overrides"
  ON public.child_model_override FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());
