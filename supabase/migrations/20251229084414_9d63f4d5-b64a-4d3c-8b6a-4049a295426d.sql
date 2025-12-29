-- Add acknowledged_at column to alerts table
ALTER TABLE alerts 
ADD COLUMN acknowledged_at TIMESTAMPTZ DEFAULT NULL;

-- Add policy for parents to update their children's alerts
CREATE POLICY "Parents can update their children alerts"
ON alerts FOR UPDATE
TO authenticated
USING (child_id IN (
  SELECT id FROM children WHERE parent_id = auth.uid()
));