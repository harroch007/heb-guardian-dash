-- Fix co-parent rows whose parents.full_name was incorrectly set to an email
-- address. Use the invited_name from family_members as the source of truth.
UPDATE public.parents p
SET full_name = fm.invited_name
FROM public.family_members fm
WHERE fm.member_id = p.id
  AND fm.status = 'accepted'
  AND fm.invited_name IS NOT NULL
  AND TRIM(fm.invited_name) <> ''
  AND (p.full_name IS NULL OR p.full_name LIKE '%@%' OR TRIM(p.full_name) = '');