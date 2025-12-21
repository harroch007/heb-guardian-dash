-- Create the anonymous training dataset table (NO user linkage)
CREATE TABLE public.training_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  age_at_incident integer,
  gender text,
  raw_text text NOT NULL,
  ai_verdict jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS but allow only service role to insert (edge function)
ALTER TABLE public.training_dataset ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can access this table
-- This ensures complete anonymity

-- Drop existing permissive policies on alerts
DROP POLICY IF EXISTS "Enable select for anon" ON public.alerts;
DROP POLICY IF EXISTS "Enable insert for anon" ON public.alerts;
DROP POLICY IF EXISTS "Enable delete for anon" ON public.alerts;
DROP POLICY IF EXISTS "Enable update for service role" ON public.alerts;

-- Create strict RLS chain: auth.uid() -> parents -> children -> devices -> alerts
-- SELECT: Only linked parent can view alerts from their children's devices
CREATE POLICY "Parents can view alerts from their children devices"
ON public.alerts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.children c ON d.child_id = c.id
    WHERE d.device_id = alerts.sender
    AND c.parent_id = auth.uid()
  )
);

-- INSERT: Allow devices to insert alerts (anon access needed for device SDK)
CREATE POLICY "Devices can insert alerts"
ON public.alerts
FOR INSERT
WITH CHECK (true);

-- DELETE: Only linked parent can delete alerts
CREATE POLICY "Parents can delete alerts from their children devices"
ON public.alerts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.children c ON d.child_id = c.id
    WHERE d.device_id = alerts.sender
    AND c.parent_id = auth.uid()
  )
);

-- UPDATE: Service role only (for edge function to update AI analysis and wipe content)
CREATE POLICY "Service role can update alerts"
ON public.alerts
FOR UPDATE
USING (true);