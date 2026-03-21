DROP POLICY IF EXISTS "Service role only" ON public.issur_melacha_windows;

CREATE POLICY "Service role only" ON public.issur_melacha_windows
  FOR ALL
  TO service_role
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');