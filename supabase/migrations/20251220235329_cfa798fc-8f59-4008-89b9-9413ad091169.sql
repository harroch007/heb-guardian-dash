-- Update children table: Make required fields NOT NULL
-- First, update any existing NULL values with defaults
UPDATE public.children 
SET phone_number = 'לא צוין' 
WHERE phone_number IS NULL;

UPDATE public.children 
SET date_of_birth = '2010-01-01' 
WHERE date_of_birth IS NULL;

UPDATE public.children 
SET gender = 'other' 
WHERE gender IS NULL;

-- Now alter the columns to NOT NULL
ALTER TABLE public.children 
  ALTER COLUMN phone_number SET NOT NULL,
  ALTER COLUMN date_of_birth SET NOT NULL,
  ALTER COLUMN gender SET NOT NULL;

-- Add gender constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'children_gender_check'
  ) THEN
    ALTER TABLE public.children 
    ADD CONSTRAINT children_gender_check 
    CHECK (gender IN ('boy', 'girl', 'other'));
  END IF;
END $$;

-- Drop existing RLS policies on parents table
DROP POLICY IF EXISTS "Parents can view their own data" ON public.parents;

-- Create proper RLS policies for parents (using id = auth.uid())
CREATE POLICY "Users can view own parent record" ON public.parents
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own parent record" ON public.parents
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own parent record" ON public.parents
  FOR UPDATE USING (auth.uid() = id);

-- Drop existing RLS policies on children table
DROP POLICY IF EXISTS "Parents can view their children" ON public.children;

-- Create proper RLS policies for children
CREATE POLICY "Parents can view own children" ON public.children
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own children" ON public.children
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own children" ON public.children
  FOR UPDATE USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete own children" ON public.children
  FOR DELETE USING (parent_id = auth.uid());