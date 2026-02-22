
-- Create promo_codes table
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL,
  discount_value integer NOT NULL,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Authenticated users can read (for code validation)
CREATE POLICY "Authenticated users can validate promo codes"
ON public.promo_codes FOR SELECT
TO authenticated
USING (true);
