-- Create internal schema for app secrets
CREATE SCHEMA IF NOT EXISTS internal;

-- Create secrets table (RLS-protected, only accessible via SECURITY DEFINER functions)
CREATE TABLE IF NOT EXISTS internal.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Restrict access - revoke from all public roles
REVOKE ALL ON SCHEMA internal FROM public, anon, authenticated;
REVOKE ALL ON internal.app_secrets FROM public, anon, authenticated;

-- Grant access only to postgres role (used by SECURITY DEFINER functions)
GRANT USAGE ON SCHEMA internal TO postgres;
GRANT SELECT ON internal.app_secrets TO postgres;

-- Create or replace the trigger function with secrets table lookup
CREATE OR REPLACE FUNCTION public.trigger_analyze_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  body_text text;
  signature text;
  webhook_secret text;
  alert_id_str text;
BEGIN
  -- Get webhook secret from internal secrets table
  SELECT value INTO webhook_secret 
  FROM internal.app_secrets 
  WHERE key = 'kippy_webhook_secret';
  
  IF webhook_secret IS NULL OR webhook_secret = '' THEN
    RAISE WARNING 'kippy_webhook_secret not found in internal.app_secrets - skipping analyze';
    RETURN NEW;
  END IF;
  
  -- Sign over alert_id STRING only (deterministic)
  alert_id_str := NEW.id::text;
  signature := encode(hmac(alert_id_str::bytea, webhook_secret::bytea, 'sha256'), 'hex');
  
  -- Build JSON body
  body_text := jsonb_build_object('alert_id', NEW.id)::text;
  
  -- POST with signature header only (NO Authorization header)
  PERFORM net.http_post(
    url := 'https://fsedenvbdpctzoznppwo.supabase.co/functions/v1/analyze-alert',
    body := body_text::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Kippy-Signature', signature
    )
  );
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on alerts table
DROP TRIGGER IF EXISTS on_alert_created ON public.alerts;
CREATE TRIGGER on_alert_created
  AFTER INSERT ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_analyze_alert();