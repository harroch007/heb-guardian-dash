-- Create app_usage table for screen time tracking
CREATE TABLE public.app_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  usage_seconds INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create device_commands table for remote actions
CREATE TABLE public.device_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
  command_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.app_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- RLS policies for app_usage (parents can view their children's app usage)
CREATE POLICY "Parents can view children app usage"
ON public.app_usage
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.children c ON d.child_id = c.id
    WHERE d.device_id = app_usage.device_id
    AND c.parent_id = auth.uid()
  )
);

-- RLS policies for device_commands
CREATE POLICY "Parents can insert commands for their children devices"
ON public.device_commands
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.children c ON d.child_id = c.id
    WHERE d.device_id = device_commands.device_id
    AND c.parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can view commands for their children devices"
ON public.device_commands
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.children c ON d.child_id = c.id
    WHERE d.device_id = device_commands.device_id
    AND c.parent_id = auth.uid()
  )
);

CREATE POLICY "Allow devices to update command status"
ON public.device_commands
FOR UPDATE
USING (true);

-- Enable realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_usage;
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;