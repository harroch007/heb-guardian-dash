-- יצירת enum לתפקידים
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- יצירת טבלת תפקידים
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, role)
);

-- הפעלת RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- מדיניות קריאה עצמית
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- פונקציה לבדיקת תפקיד (Security Definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- פונקציה נוחה לבדיקת אדמין
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- הפעלת RLS על training_dataset
ALTER TABLE public.training_dataset ENABLE ROW LEVEL SECURITY;

-- רק אדמינים יכולים לצפות
CREATE POLICY "Only admins can view training data"
ON public.training_dataset FOR SELECT
TO authenticated
USING (public.is_admin());