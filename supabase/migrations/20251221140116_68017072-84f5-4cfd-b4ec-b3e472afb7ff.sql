-- Add DELETE policy for alerts table
CREATE POLICY "Enable delete for anon" 
ON public.alerts 
FOR DELETE 
USING (true);

-- Add UPDATE policy for alerts table (needed for AI analysis updates)
CREATE POLICY "Enable update for service role" 
ON public.alerts 
FOR UPDATE 
USING (true);