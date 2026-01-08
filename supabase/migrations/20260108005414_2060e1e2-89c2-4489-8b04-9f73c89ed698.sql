-- Fix trigger function to use SECURITY DEFINER so it can insert into calendar_sync_queue
CREATE OR REPLACE FUNCTION public.trigger_calendar_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a record into a sync queue table that a cron job will process
  INSERT INTO public.calendar_sync_queue (discovery_call_id, created_at, status)
  VALUES (NEW.id, now(), 'pending')
  ON CONFLICT (discovery_call_id) DO UPDATE SET status = 'pending', created_at = now();
  
  RETURN NEW;
END;
$$;

-- Also add policy for authenticated users to insert (as backup)
DROP POLICY IF EXISTS "Authenticated users can insert calendar sync queue" ON public.calendar_sync_queue;
CREATE POLICY "Authenticated users can insert calendar sync queue" 
ON public.calendar_sync_queue 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);