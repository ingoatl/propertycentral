-- Create function to sync owner phone from onboarding tasks
CREATE OR REPLACE FUNCTION public.sync_owner_phone_from_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner_id_val uuid;
  phone_val text;
BEGIN
  -- Only proceed if the task title is 'Owner Phone' and has a value
  IF NEW.title = 'Owner Phone' AND NEW.field_value IS NOT NULL AND NEW.field_value != '' THEN
    -- Get the property_id from the project, then find the owner
    SELECT p.owner_id INTO owner_id_val
    FROM onboarding_projects op
    JOIN properties p ON p.id = op.property_id
    WHERE op.id = NEW.project_id;
    
    IF owner_id_val IS NOT NULL THEN
      -- Format phone number (add +1 if needed)
      phone_val := NEW.field_value;
      
      -- Update the owner's phone
      UPDATE property_owners
      SET phone = phone_val
      WHERE id = owner_id_val AND (phone IS NULL OR phone = '');
      
      RAISE NOTICE 'Synced phone % to owner %', phone_val, owner_id_val;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on onboarding_tasks
DROP TRIGGER IF EXISTS sync_owner_phone_on_task_update ON onboarding_tasks;
CREATE TRIGGER sync_owner_phone_on_task_update
  AFTER INSERT OR UPDATE OF field_value
  ON onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION sync_owner_phone_from_onboarding();

-- Run a one-time sync for all existing owners without phone
UPDATE property_owners po
SET phone = (
  SELECT ot.field_value
  FROM onboarding_projects op
  JOIN properties p ON p.id = op.property_id
  JOIN onboarding_tasks ot ON ot.project_id = op.id
  WHERE p.owner_id = po.id
    AND ot.title = 'Owner Phone'
    AND ot.field_value IS NOT NULL
    AND ot.field_value != ''
  LIMIT 1
)
WHERE po.phone IS NULL OR po.phone = '';