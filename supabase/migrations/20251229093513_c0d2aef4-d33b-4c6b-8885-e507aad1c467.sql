-- Create device_events table for tracking device events
CREATE TABLE public.device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'heartbeat_lost', 'app_uninstalled', 'permission_removed', 'battery_critical'
  event_data JSONB DEFAULT '{}'::jsonb,
  is_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;

-- Create index for efficient queries
CREATE INDEX idx_device_events_device_id ON public.device_events(device_id);
CREATE INDEX idx_device_events_created_at ON public.device_events(created_at DESC);
CREATE INDEX idx_device_events_event_type ON public.device_events(event_type);

-- RLS policies
-- Parents can view events from their children's devices
CREATE POLICY "Parents can view their children device events"
ON public.device_events
FOR SELECT
USING (
  child_id IN (
    SELECT id FROM children WHERE parent_id = auth.uid()
  )
);

-- Service role can insert events (for edge functions)
CREATE POLICY "Service role can insert device events"
ON public.device_events
FOR INSERT
WITH CHECK (true);

-- Service role can update events
CREATE POLICY "Service role can update device events"
ON public.device_events
FOR UPDATE
USING (true);