
-- Step 1: Remove phone from admin account to resolve duplicate
UPDATE parents SET phone = NULL WHERE id = '532d5cab-aa32-4647-81e8-dab1016306c2';

-- Step 2: Create unique indexes
CREATE UNIQUE INDEX uq_parents_phone 
  ON parents (phone) 
  WHERE phone IS NOT NULL AND phone <> '';

CREATE UNIQUE INDEX uq_parents_email 
  ON parents (email) 
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX uq_children_phone_number 
  ON children (phone_number) 
  WHERE phone_number IS NOT NULL AND phone_number <> '';
