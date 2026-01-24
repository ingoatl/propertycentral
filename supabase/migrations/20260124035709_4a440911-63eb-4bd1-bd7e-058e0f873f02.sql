-- Create a function to trigger property sync to Communications Hub
CREATE OR REPLACE FUNCTION public.trigger_comms_hub_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for Client-Managed or Company-Owned properties
  IF NEW.property_type IN ('Client-Managed', 'Company-Owned') AND NEW.offboarded_at IS NULL THEN
    -- Insert into a sync queue that a cron job or edge function can process
    INSERT INTO public.comms_hub_sync_queue (property_id, sync_type, created_at, status)
    VALUES (NEW.id, 'property_added', now(), 'pending')
    ON CONFLICT (property_id) 
    DO UPDATE SET 
      sync_type = CASE 
        WHEN comms_hub_sync_queue.status = 'completed' THEN 'property_updated'
        ELSE comms_hub_sync_queue.sync_type
      END,
      status = 'pending',
      created_at = now();
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the sync queue table
CREATE TABLE IF NOT EXISTS public.comms_hub_sync_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL UNIQUE,
  sync_type text NOT NULL DEFAULT 'property_added',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE
);

-- Create index for pending items
CREATE INDEX IF NOT EXISTS idx_comms_hub_sync_queue_pending 
ON public.comms_hub_sync_queue (status) 
WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.comms_hub_sync_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to comms_hub_sync_queue"
ON public.comms_hub_sync_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for new/updated properties
DROP TRIGGER IF EXISTS trigger_comms_hub_property_sync ON public.properties;
CREATE TRIGGER trigger_comms_hub_property_sync
AFTER INSERT OR UPDATE OF property_type, name, address, image_path, offboarded_at
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.trigger_comms_hub_sync();