
-- Create a function to trigger calendar sync via pg_net (async HTTP call)
CREATE OR REPLACE FUNCTION public.trigger_calendar_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get the Supabase URL and service role key from vault or use direct values
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Insert a record into a sync queue table that a cron job will process
  INSERT INTO public.calendar_sync_queue (discovery_call_id, created_at, status)
  VALUES (NEW.id, now(), 'pending')
  ON CONFLICT (discovery_call_id) DO UPDATE SET status = 'pending', created_at = now();
  
  RETURN NEW;
END;
$function$;

-- Create calendar sync queue table
CREATE TABLE IF NOT EXISTS public.calendar_sync_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discovery_call_id UUID NOT NULL UNIQUE REFERENCES public.discovery_calls(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.calendar_sync_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage the queue
CREATE POLICY "Service role can manage calendar sync queue"
ON public.calendar_sync_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger to queue sync on new discovery calls
DROP TRIGGER IF EXISTS trigger_calendar_sync_on_insert ON public.discovery_calls;
CREATE TRIGGER trigger_calendar_sync_on_insert
AFTER INSERT ON public.discovery_calls
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calendar_sync();
