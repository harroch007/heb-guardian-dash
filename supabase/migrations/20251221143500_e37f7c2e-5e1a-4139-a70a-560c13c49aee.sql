-- Add device_id column to alerts table
ALTER TABLE public.alerts 
ADD COLUMN device_id text REFERENCES public.devices(device_id);

-- Create index for faster lookups
CREATE INDEX idx_alerts_device_id ON public.alerts(device_id);