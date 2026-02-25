
-- Create customer_groups table
CREATE TABLE public.customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  model_name text,  -- NULL = use default from ai_model_config
  is_default boolean NOT NULL DEFAULT false,
  color text DEFAULT '#7C3AED',
  created_at timestamptz DEFAULT now()
);

-- Add group_id to parents
ALTER TABLE public.parents ADD COLUMN group_id uuid REFERENCES public.customer_groups(id);

-- Insert default group
INSERT INTO public.customer_groups (name, description, is_default, color) VALUES
  ('פרימיום', 'לקוחות משלמים — מודל ברירת מחדל', true, '#7C3AED');

-- Enable RLS
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage groups" ON public.customer_groups FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Authenticated users can view groups
CREATE POLICY "Authenticated can view groups" ON public.customer_groups FOR SELECT USING (auth.uid() IS NOT NULL);
