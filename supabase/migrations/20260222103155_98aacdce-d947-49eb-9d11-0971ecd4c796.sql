
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_processing_status_check;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_processing_status_check
  CHECK (processing_status IN (
    'pending', 'analyzing', 'analyzed', 
    'notifying', 'notified', 
    'grouped', 'daily_cap',
    'succeeded', 'failed'
  ));
