
-- Step 1: Create a non-recursive helper function for children access
CREATE OR REPLACE FUNCTION public.can_access_child_row(p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Owner check
    p_parent_id = auth.uid()
    OR
    -- Co-parent check
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.owner_id = p_parent_id
        AND fm.member_id = auth.uid()
        AND fm.status = 'accepted'
    )
$$;

REVOKE ALL ON FUNCTION public.can_access_child_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_child_row(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_child_row(uuid) TO anon;

-- Step 2: Drop old SELECT policies on children
DROP POLICY IF EXISTS "Parents can view own children" ON public.children;

-- Step 3: Create new non-recursive SELECT policy
CREATE POLICY "Parents can view own children"
ON public.children
FOR SELECT
TO public
USING (can_access_child_row(parent_id));

-- Step 4: Drop old UPDATE policy and recreate
DROP POLICY IF EXISTS "Parents can update own children" ON public.children;

CREATE POLICY "Parents can update own children"
ON public.children
FOR UPDATE
TO public
USING (can_access_child_row(parent_id));
