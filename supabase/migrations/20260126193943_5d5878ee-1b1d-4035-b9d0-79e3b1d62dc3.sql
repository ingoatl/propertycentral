-- Add 'On-Hold' to property_type enum
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'On-Hold' BEFORE 'Inactive';

-- Add hold tracking columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS on_hold_at timestamp with time zone;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS on_hold_reason text;

-- Update the sync trigger to exclude On-Hold properties (already excludes by only allowing Client-Managed and Company-Owned)
CREATE OR REPLACE FUNCTION public.trigger_comms_hub_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger for Client-Managed or Company-Owned properties (excludes On-Hold, Inactive, Partner)
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